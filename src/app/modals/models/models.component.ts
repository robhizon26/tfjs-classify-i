import { HttpClient } from '@angular/common/http';
import { Component, Input, OnInit } from '@angular/core';
import { Plugins } from '@capacitor/core';
import { ActionSheetController, AlertController, ModalController } from '@ionic/angular';
import { createLabelsClass } from '../../utils/utilities';
import { ClassesComponent } from '../classes/classes.component';

@Component({
  selector: 'app-models',
  templateUrl: './models.component.html',
  styleUrls: ['./models.component.scss'],
})
export class ModelsComponent implements OnInit {
  @Input() screenStatus: string;
  @Input() model: any;
  @Input() amodel: any;
  aModels: any[] = [];
  hasLoadNewModel: boolean = false;

  constructor(
    private modalCtrl: ModalController,
    private httpClient: HttpClient,
    private actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController
  ) { }

  ngOnInit() {
    if (this.amodel) this.aModels = JSON.parse(this.amodel);
    if (this.model) this.model = JSON.parse(this.model);
  }

  onClose() {
    const returnData = {
      screenStatus: this.screenStatus,
      hasLoadNewModel: this.hasLoadNewModel
    };
    this.modalCtrl.dismiss(returnData);
  }

  private showAlert(title, msg) {
    this.alertCtrl
      .create({
        header: title,
        message: msg,
        buttons: ['Okay']
      })
      .then(alertEl => alertEl.present());
  }

  onChooseModel(model) {
    if (model.error) {
      this.showAlert(model.error.title, model.error.message);
    } else {
      this.actionSheetCtrl
        .create({
          header: 'Please Choose',
          buttons: [
            {
              text: 'Load model',
              handler: async () => {
                await Plugins.Storage.set({ key: 'model', value: JSON.stringify(model) });
                this.hasLoadNewModel = true;
                this.onClose();
              }
            },
            {
              text: 'Model info',
              handler: () => {
                this.showAlert("Model info for '" + model.name + "'",
                  'Format: <b>' + model.info.format + '</b><br>Version: <b>' + model.info.version + '</b><br>Dim : <b>' + model.info.dim + '</b>')
              }
            },
            {
              text: 'View classes',
              handler: async () => {
                const fullmodelpath = 'assets/model/' + model.path + '/' + model.name + '/'
                const plabels = await this.httpClient.get(fullmodelpath + 'labels.txt', { responseType: 'text' }).toPromise();
                const labels = createLabelsClass(plabels);
                this.modalCtrl.create({
                  component: ClassesComponent,
                  componentProps: {
                    screenStatus: this.screenStatus,
                    xLabels: JSON.stringify(labels)
                  }
                })
                  .then(modalEl => {
                    modalEl.onDidDismiss().then(modalData => {
                      if (!modalData.data) {
                        return;
                      }
                      this.screenStatus = modalData.data.screenStatus;
                    });
                    modalEl.present();
                  });
              }
            },
            { text: 'Cancel', role: 'cancel' }
          ]
        })
        .then(actionSheetEl => {
          actionSheetEl.present();
        });
    }
  }

  onGetColor(p_model) {
    let fullmodelpath = 'assets/model/' + p_model.path + '/' + p_model.name + '/'
    let isActive: boolean = false;
    if (this.model) {
      let savedfullmodelpath = 'assets/model/' + this.model.path + '/' + this.model.name + '/'
      fullmodelpath = fullmodelpath.replace('//', '/');
      savedfullmodelpath = savedfullmodelpath.replace('//', '/');
      isActive = fullmodelpath == savedfullmodelpath
    }
    if (isActive) return 'orangered';
    if (p_model.error) return 'darkgray';
    return 'black';
  }
}
