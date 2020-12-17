import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Plugins } from '@capacitor/core';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit {
  @Input() screenStatus: string;
  predictionCnt: number = 5;
  predictionPct: number = 0;
  allowsEditing: boolean = false;

  oldPredictionCnt: number = 5;
  oldPredictionPct: number = 0;
  oldAllowsEditing: boolean = false;

  constructor(private modalCtrl: ModalController,) { }
  async ngOnInit() {
    let plgVl = await Plugins.Storage.get({ key: 'predictionCnt' });
    if (plgVl.value) this.predictionCnt = parseInt(plgVl.value);
    plgVl = await Plugins.Storage.get({ key: 'predictionPct' });
    if (plgVl.value) this.predictionPct = parseInt(plgVl.value);
    plgVl = await Plugins.Storage.get({ key: 'allowsEditing' });
    if (plgVl.value) this.allowsEditing = plgVl.value == 'true' ? true : false;

    this.oldPredictionCnt= this.predictionCnt;
    this.oldPredictionPct= this.predictionPct;
    this.oldAllowsEditing= this.allowsEditing;
  }

  onClose() {
    let hasChanged: boolean = false;
    if (this.oldPredictionCnt != this.predictionCnt) hasChanged = true;
    if (this.oldPredictionPct != this.predictionPct) hasChanged = true;
    if (this.oldAllowsEditing != this.allowsEditing) hasChanged = true;
    if (hasChanged) {
      Plugins.Storage.set({ key: 'predictionCnt', value: this.predictionCnt.toString() });
      Plugins.Storage.set({ key: 'predictionPct', value: this.predictionPct.toString() });
      Plugins.Storage.set({ key: 'allowsEditing', value: this.allowsEditing.toString() });
    }
    const returnData = {
      screenStatus: this.screenStatus,
      hasChanged: hasChanged
    };
    this.modalCtrl.dismiss(returnData);
  }

  onChangePredictionCnt = value => this.predictionCnt = value;
  onChangePredictionPct = value => this.predictionPct = value;
  onChangeAllowsEditing = value => this.allowsEditing = value;
}
