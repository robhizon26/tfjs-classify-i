import { Component, ViewChild, ElementRef, AfterViewInit, OnInit } from "@angular/core";
import { AlertController, LoadingController, ModalController, Platform, ToastController } from "@ionic/angular";
import { SplashScreen } from "@ionic-native/splash-screen/ngx";
import { StatusBar } from "@ionic-native/status-bar/ngx";
import { Plugins, Capacitor, CameraSource, CameraResultType, } from "@capacitor/core";
import * as tf from "@tensorflow/tfjs";
import { Prediction } from "./models/predictions";
import * as modellib from "./modellib";
import { HttpClient } from "@angular/common/http";
import { SettingsComponent } from "./modals/settings/settings.component";
import { ClassesComponent } from "./modals/classes/classes.component";
import { AboutComponent } from "./modals/about/about.component";
import { ModelsComponent } from "./modals/models/models.component";
import { createLabelsClass, getArray } from "./utils/utilities";

@Component({
  selector: "app-root",
  templateUrl: "app.component.html",
  styleUrls: ["app.component.scss"],
})
export class AppComponent implements OnInit, AfterViewInit {
  @ViewChild("canvas") canvas: ElementRef<HTMLCanvasElement>;
  @ViewChild("video") video: ElementRef<HTMLVideoElement>;
  canvasElement: HTMLCanvasElement;
  videoElement: HTMLVideoElement;

  newpredictions: Prediction[] = [];
  hasListDetail: boolean = false;
  selectedImage: string = "assets/ezgif.com-crop2.gif";
  context: any;
  screenStatus: string = "play";
  waitTime: number = 30;
  model: any;
  labels: { [classId: number]: string };
  predictionCnt: number = 5;
  predictionPct: number = 0;
  frameInterval: any;
  hasRenderedImages: boolean = false;
  videoDim: any[] = [];
  savedModel: any;
  videoElemPct: any = { width: "100%", height: "100%" };
  aModels: any[] = [];
  basepath: string = "assets/model";
  isOnDevice: boolean = false;

  constructor(
    private platform: Platform,
    private splashScreen: SplashScreen,
    private statusBar: StatusBar,
    private toastController: ToastController,
    private httpClient: HttpClient,
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController
  ) { }

  ngOnInit() {
    this.initializeApp();
    this.platform.ready().then(() => {
      this.isOnDevice = (this.platform.is("android") || this.platform.is("ios")) && this.platform.is("hybrid");
      console.log("isOnDevice:", this.isOnDevice);
      if (this.isOnDevice) {
        window.screen.orientation.lock("portrait");
      }
    });
  }

  ngAfterViewInit() {
    this.platform.ready().then(async () => {
      this.preInitializedScreen(null);
    });
  }

  private async preInitializedScreen(loadingEl) {
    //check if modelPath is set
    let plgVl = await Plugins.Storage.get({ key: "model" });
    if (plgVl.value) {
      this.savedModel = JSON.parse(plgVl.value);
      if (this.savedModel) {
        const fullmodelpath = this.basepath + "/" + this.savedModel.path + "/" + this.savedModel.name + "/";
        let modelpath = fullmodelpath.replace("//", "/");
        try {
          const plabels = await this.httpClient.get(modelpath + "labels.txt", { responseType: "text" }).toPromise();
          this.labels = createLabelsClass(plabels);
        } catch (error) { }
        const modelurl = "/" + modelpath;
        const availableModels = {
          any: [modelurl,
            {
              size: this.savedModel.info.dim,
              type: this.savedModel.info.format,
              labels: this.labels,
            },
          ],
        };
        const currentModelName: any = "any";
        try {
          this.model = await modellib.load(...availableModels[currentModelName]);
        } catch (error) {
          this.showAlert("Error", error);
        }
        this.newpredictions = [];
        this.initializedScreen();
        if (loadingEl) loadingEl.dismiss();
      }
    }
  }

  private async getModels() {
    let isOk: boolean = true;
    //check models in assets/model/
    let modelpaths;
    try {
      modelpaths = await this.httpClient.get(this.basepath + "/modeldirectory.txt", { responseType: "text" }).toPromise();
    } catch {
      isOk = false;
      this.showAlert("File not found", "There was an error retreiving assets/model/modeldirectory.txt");
    }
    if (!isOk) return;
    let amodelpaths;
    try {
      amodelpaths = getArray(modelpaths);
    } catch {
      isOk = false;
      this.showAlert("Error", "There was an error on  modeldirectory.txt");
    }
    if (!isOk) return;
    for (let i = 0; i < amodelpaths.length; i++) {
      let modelpath = amodelpaths[i].trim();
      if (modelpath.trim().length > 0) {
        let pathParts = modelpath.split("/");
        const name = pathParts[pathParts.length - 1];
        let path = modelpath.substring(0, modelpath.lastIndexOf("/"));
        const fullmodelpath = this.basepath + "/" + modelpath + "/";
        const error = await this.isModelPathNotLegit(fullmodelpath);
        let info = null;
        if (!error) {
          info = await this.getModelInfo(fullmodelpath);
        }
        this.aModels.push({ name, path, error, info });
      }
    }
  }

  private async isModelPathNotLegit(fullmodelpath) {
    let textvalue;
    try {
      textvalue = await this.httpClient.get(fullmodelpath + "labels.txt", { responseType: "text" }).toPromise();
    } catch {
      return {
        title: "File not found",
        message: "There was an error retreiving " + fullmodelpath + "labels.txt",
      };
    }
    try {
      textvalue = await this.httpClient.get(fullmodelpath + "model.json", { responseType: "text" }).toPromise();
    } catch {
      return {
        title: "File not found",
        message: "There was an error retreiving " + fullmodelpath + "model.json",
      };
    }
    return null;
  }

  private async getModelInfo(fullmodelpath) {
    try {
      let jsonvalue: any = await this.httpClient.get(fullmodelpath + "model.json").toPromise();
      let format;
      let version;
      let dim: number;
      if (jsonvalue) {
        for (var key in jsonvalue) {
          //check if graph format
          if (key.indexOf("format") > -1) {
            format =
              jsonvalue.format.indexOf("graph") > -1
                ? "graph"
                : jsonvalue.format;
            version = jsonvalue.generatedBy;
            let input = jsonvalue.userDefinedMetadata.signature.inputs;
            if (input) {
              for (var key in input) {
                if (key.indexOf("input") > -1) {
                  dim = parseInt(input[key].tensorShape.dim[1].size);
                  break;
                }
              }
            }
            if (!input) return null;
            break;
          }
          //check if keras format
          if (key.indexOf("modelTopology") > -1) {
            format = "keras";
            version = jsonvalue.modelTopology.keras_version;
            dim =
              jsonvalue.modelTopology.model_config.config.layers[0].config
                .batch_input_shape[1];
            break;
          }
        }
      }
      return { format, version, dim };
    } catch {
      return null;
    }
  }

  private initializeApp() {
    this.platform.ready().then(() => {
      this.statusBar.styleDefault();
      this.splashScreen.hide();
    });
  }

  async loadVideo() {
    await this.setupCamera();
    this.videoElement.play();
  }

  async setupCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.showAlert("Error", "Browser API navigator.mediaDevices.getUserMedia not available");
    }
    this.canvasElement = this.canvas.nativeElement;
    this.videoElement = this.video.nativeElement;
    // Get access to the camera!
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      // Not adding `{ audio: true }` since we only want video now
      await navigator.mediaDevices
        .getUserMedia({
          video: {
            facingMode: "environment",
          },
        })
        .then((stream) => {
          this.videoElement.srcObject = stream;
        });
    }

    return new Promise((resolve) => {
      this.videoElement.onloadedmetadata = () => {
        this.videoDim = [
          this.videoElement.videoWidth,
          this.videoElement.videoHeight,
        ];
        resolve(this.videoDim);
      };
    });
  }

  initializedScreen() {
    this.hasRenderedImages = false;
    if (this.context) {
      this.context = this.canvasElement.getContext("2d");
      this.context.clearRect(
        0,
        0,
        this.canvasElement.width,
        this.canvasElement.height
      );
    }
    setTimeout(async () => {
      let plgVl = await Plugins.Storage.get({ key: "predictionCnt" });
      if (plgVl.value) this.predictionCnt = parseInt(plgVl.value);
      plgVl = await Plugins.Storage.get({ key: "predictionPct" });
      if (plgVl.value) this.predictionPct = parseInt(plgVl.value);
      if (this.screenStatus == "play") await this.loadVideo();
      this.renderImages();
    }, this.waitTime);
  }

  onSelectVideoFrame() {
    if (!this.hasRenderedImages) return;
    //toggle
    if (this.screenStatus === "play") this.pauseVideo();
    else if (this.screenStatus === "photo") {
      this.screenStatus = "play";
    } else if (this.screenStatus === "pause") this.screenStatus = "play";
    //set
    if (this.screenStatus === "play") this.initializedScreen();
    if (this.screenStatus === "pause") {
      this.videoElement.pause();
    }
  }

  async onPickImage() {
    if (!Capacitor.isPluginAvailable("Camera")) {
      return;
    }
    let allowsEditing = true;
    const plgVl = await Plugins.Storage.get({ key: "allowsEditing" });
    if (plgVl.value) allowsEditing = plgVl.value == "true" ? true : false;

    this.loadingCtrl.create({ message: "Loading...", duration: 20000 }).then((loadingEl) => {
      if (this.isOnDevice) loadingEl.present();
      Plugins.Camera.getPhoto({
        quality: 50,
        source: CameraSource.Photos,
        correctOrientation: true,
        allowEditing: allowsEditing,
        resultType: CameraResultType.Base64,
      })
        .finally(() => {
          loadingEl.dismiss();
        })
        .then((image) => {
          clearInterval(this.frameInterval);
          this.selectedImage = "data:image/jpeg;base64," + image.base64String;
          this.screenStatus = "photo";
          loadingEl.dismiss();
          this.renderImages();
        })
        .catch((error) => {
          console.log(error);
          return false;
        });
    });
  }

  private renderImages() {
    this.hasRenderedImages = true;
    const padding = 0.1; //10% padding on each side
    setTimeout(() => {
      if (this.videoElement && (this.screenStatus === "play" || this.screenStatus === "pause")) {
        tf.tidy(() => {
          const pixels = tf.browser.fromPixels(this.videoElement);
          const width = this.videoElement.videoWidth;
          const height = this.videoElement.videoHeight;
          let newheight = this.videoElement.videoHeight;
          let newheightneglee = 0;
          if (height > width) {
            newheight = width;
            newheightneglee = height - width * 1.2;
            this.videoElemPct.height = ((width * 80) / height).toFixed(0) + "%";
          }
          const paddedWidth = width * (1 - padding);
          const paddedHeight = newheight * (1 - padding);
          let VIDEO_PIXELS = paddedWidth < paddedHeight ? paddedWidth : paddedHeight;
          const centerWidth = width / 2;
          const centerHeight = height / 2 - newheightneglee;
          const beginWidth = centerWidth - VIDEO_PIXELS / 2;
          const beginHeight = centerHeight - VIDEO_PIXELS / 2;
          const pixelsCropped = pixels.slice(
            [beginHeight, beginWidth, 0],
            [VIDEO_PIXELS, VIDEO_PIXELS, 3]
          );

          this.doPredictions(pixelsCropped);
          if (this.screenStatus === "play")
            requestAnimationFrame(() => this.renderImages());
        });
      }
      if (this.screenStatus === "photo") {
        console.log("screenStatus === photo");
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = this.selectedImage;
        let onloaded = false;
        img.onload = () => {
          if (!onloaded) {
            console.log("async renderImages photo pause");
            this.doPredictions(img);
          }
          onloaded = true;
        };
      }
    }, this.waitTime * 20);
  }

  private doPredictions(img) {
    console.log("doPredictions this.predictionCnt", this.predictionCnt);
    this.model.classify(img, this.predictionCnt).then((predictions) => {
      console.log("doPredictions predictions", predictions);
      this.newpredictions = predictions.filter(
        (prediction) => prediction.probability * 100 >= this.predictionPct
      );
    });
  }

  async showToast(message) {
    const toast = await this.toastController.create({ message, duration: 20000 });
    return await toast.present();
  }

  onChangeSetting() {
    this.modalCtrl
      .create({
        component: SettingsComponent,
        componentProps: { screenStatus: this.screenStatus },
      })
      .then((modalEl) => {
        modalEl.onDidDismiss().then((modalData) => {
          if (!modalData.data) {
            return;
          }
          this.screenStatus = modalData.data.screenStatus;
          if (modalData.data.hasChanged) this.initializedScreen();
          else this.renderImages();
        });
        modalEl.present();
        this.pauseVideo();
      });
  }

  pauseVideo() {
    this.screenStatus = "pause";
    clearInterval(this.frameInterval);
  }

  onViewClasses() {
    this.modalCtrl
      .create({
        component: ClassesComponent,
        componentProps: {
          screenStatus: this.screenStatus,
          xLabels: JSON.stringify(this.labels),
        },
      })
      .then((modalEl) => {
        modalEl.onDidDismiss().then((modalData) => {
          if (!modalData.data) {
            return;
          }
          this.screenStatus = modalData.data.screenStatus;
          this.renderImages();
        });
        modalEl.present();
        this.pauseVideo();
      });
  }

  async onViewModels() {
    this.loadingCtrl
      .create({ message: "Loading..." })
      .then(async (loadingEl) => {
        if (this.aModels.length == 0) {
          loadingEl.present();
          await this.getModels();
        }
        loadingEl.dismiss();
        this.modalCtrl
          .create({
            component: ModelsComponent,
            componentProps: {
              screenStatus: this.screenStatus,
              model: JSON.stringify(this.savedModel),
              amodel: JSON.stringify(this.aModels),
            },
          })
          .then((modalEl) => {
            modalEl.onDidDismiss().then((modalData) => {
              const modeldata = modalData.data;
              if (!modeldata) {
                return;
              }
              this.screenStatus = modeldata.screenStatus;
              if (modeldata.hasLoadNewModel) {
                this.loadingCtrl
                  .create({ message: "Loading..." })
                  .then((loadingEl) => {
                    loadingEl.present();
                    this.preInitializedScreen(loadingEl);
                  });
              } else {
                this.renderImages();
              }
            });
            modalEl.present();
            this.pauseVideo();
          });
      });
  }

  onAboutThisApp() {
    this.modalCtrl
      .create({
        component: AboutComponent,
        componentProps: {
          screenStatus: this.screenStatus,
          videoDim: this.videoDim,
          model: JSON.stringify(this.savedModel),
        },
      })
      .then((modalEl) => {
        modalEl.onDidDismiss().then((modalData) => {
          if (!modalData.data) {
            return;
          }
          this.screenStatus = modalData.data.screenStatus;
          this.renderImages();
        });
        modalEl.present();
        this.pauseVideo();
      });
  }

  onRefreshScreen() {
    window.location.reload();
  }

  private showAlert(title, msg) {
    this.alertCtrl
      .create({
        header: title,
        message: msg,
        buttons: ["Okay"],
      })
      .then((alertEl) => alertEl.present());
  }
}
