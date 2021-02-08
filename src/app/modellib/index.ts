import * as tf from "@tensorflow/tfjs";

interface frameResult {
  index: number;
  totalFrames: number;
  predictions: Array<Object>;
}

interface Options {
  size?: number;
  type?: string;
  labels?: { [classId: number]: string };
}

const BASE_PATH = 'https://storage.googleapis.com/tfjs-models/savedmodel/mobilenet_v2_1.0_224/';
const IMAGE_SIZE = 224; // default to Mobilenet v2

export async function load(base = BASE_PATH, options = { size: IMAGE_SIZE }) {
  if (tf == null) {
    throw new Error(
      `Cannot find TensorFlow.js. If you are using a <script> tag, please ` +
      `also include @tensorflow/tfjs on the page before using this model.`
    );
  }
  // Default size is IMAGE_SIZE - needed if just type option is used
  options.size = options.size || IMAGE_SIZE;
  const modelGraphNet = new ModelLib(base, options);
  await modelGraphNet.load();
  return modelGraphNet;
}

interface IOHandler {
  load: () => any;
}

export class ModelLib {
  public endpoints: string[];

  private options: Options;
  private pathOrIOHandler: string | IOHandler;
  private model: tf.LayersModel | tf.GraphModel;
  private intermediateModels: { [layerName: string]: tf.LayersModel } = {};

  private normalizationOffset: tf.Scalar;
  private labels: { [classId: number]: string };
  constructor(
    modelPathBaseOrIOHandler: string | IOHandler,
    options: Options
  ) {
    this.options = options;
    this.normalizationOffset = tf.scalar(255);

    if (typeof modelPathBaseOrIOHandler === "string") {
      this.pathOrIOHandler = `${modelPathBaseOrIOHandler}model.json`;
    } else {
      this.pathOrIOHandler = modelPathBaseOrIOHandler;
    }
  }

  async load() {
    const { size, type, labels } = this.options;
    this.labels = labels;
    if (type === "graph") {
      this.model = await tf.loadGraphModel(this.pathOrIOHandler);
    } else {
      // this is a Layers Model
      this.model = await tf.loadLayersModel(this.pathOrIOHandler);
      this.endpoints = this.model.layers.map((l) => l.name);
    }

    // Warmup the model.
    const result = tf.tidy(() =>
      this.model.predict(tf.zeros([1, size, size, 3]))
    ) as tf.Tensor;
    await result.data();
    result.dispose();
  }

  /**
   * Infers through the model. Optionally takes an endpoint to return an
   * intermediate activation.
   *
   * @param img The image to classify. Can be a tensor or a DOM element image,
   * video, or canvas.
   * @param endpoint The endpoint to infer through. If not defined, returns
   * logits.
   */
  infer(
    img:
      | tf.Tensor3D
      | ImageData
      | HTMLImageElement
      | HTMLCanvasElement
      | HTMLVideoElement,
    endpoint?: string
  ): tf.Tensor {
    if (endpoint != null && this.endpoints.indexOf(endpoint) === -1) {
      throw new Error(
        `Unknown endpoint ${endpoint}. Available endpoints: ` +
        `${this.endpoints}.`
      );
    }
    return tf.tidy(() => {
      if (!(img instanceof tf.Tensor)) {
        img = tf.browser.fromPixels(img);
      }
      // Normalize the image from [0, 255] to [0, 1].
      const normalized = img
        .toFloat()
        .div(this.normalizationOffset) as tf.Tensor3D;

      // Resize the image to
      let resized = normalized;
      const { size } = this.options;
      // check width and height if resize needed
      if (img.shape[0] !== size || img.shape[1] !== size) {
        const alignCorners = true;
        resized = tf.image.resizeBilinear(
          normalized,
          [size, size],
          alignCorners
        );
      }

      // Reshape to a single-element batch so we can pass it to predict.
      const batched = resized.reshape([1, size, size, 3]);

      let model: tf.LayersModel | tf.GraphModel;
      if (endpoint == null) {
        model = this.model;
      } else {
        if (
          this.model.hasOwnProperty("layers") &&
          this.intermediateModels[endpoint] == null
        ) {
          // @ts-ignore
          const layer = this.model.layers.find((l) => l.name === endpoint);
          this.intermediateModels[endpoint] = tf.model({
            // @ts-ignore
            inputs: this.model.inputs,
            outputs: layer.output,
          });
        }
        model = this.intermediateModels[endpoint];
      }

      // return logits
      return model.predict(batched) as tf.Tensor2D;
    });
  }

  /**
   * Classifies an image from the 5 classes returning a map of
   * the most likely class names to their probability.
   *
   * @param img The image to classify. Can be a tensor or a DOM element image,
   * video, or canvas.
   * @param topk How many top values to use. Defaults to 5
   */
  async classify(
    img:
      | tf.Tensor3D
      | ImageData
      | HTMLImageElement
      | HTMLCanvasElement
      | HTMLVideoElement,
    topk = 5
  ): Promise<Array<{ className: string; probability: number }>> {
    const logits = this.infer(img) as tf.Tensor2D;
    const classes = await getTopKClasses(logits, topk, this.labels);
    logits.dispose();
    return classes;
  }
}

async function getTopKClasses(
  logits: tf.Tensor2D,
  topK: number,
  xlabels: { [classId: number]: string }
): Promise<Array<{ className: string; probability: number }>> {
  const values = await logits.data();
  // console.log('logits', values)
  let valuesAndIndices = [];
  for (let i = 0; i < values.length; i++) {
    valuesAndIndices.push({ value: values[i], index: i });
  }
  valuesAndIndices.sort((a, b) => {
    return b.value - a.value;
  });
  // quantized from 0 to 1 to make percentile working properly
  let maxvalue = valuesAndIndices[0].value;
  let minvalue = valuesAndIndices[valuesAndIndices.length - 1].value;
  let total = 0;

  if (maxvalue >= 1 || minvalue <= 0) {
    valuesAndIndices = valuesAndIndices.map(item => {
      item.value -= minvalue;
      total +=  item.value
      return item;
    })
    valuesAndIndices = valuesAndIndices.map(item => {
      item.value /= total;
      return item;
    })
  }
  
  topK = valuesAndIndices.length < topK ? valuesAndIndices.length : topK;
  // topK = valuesAndIndices.length 
  const topkValues = new Float32Array(topK);
  const topkIndices = new Int32Array(topK);
  for (let i = 0; i < topK; i++) {
    topkValues[i] = valuesAndIndices[i].value;
    topkIndices[i] = valuesAndIndices[i].index;
  }
  const topClassesAndProbs = [];
  for (let i = 0; i < topkIndices.length; i++) {
    topClassesAndProbs.push({
      className: xlabels[topkIndices[i]],
      probability: topkValues[i],
    });
  }
  return topClassesAndProbs;
}
