import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-classes',
  templateUrl: './classes.component.html',
  styleUrls: ['./classes.component.scss'],
})
export class ClassesComponent implements OnInit {
  @Input() xLabels: string;
  @Input() screenStatus: string;
  aLabels:any[]=[]; 
  fLabels:any[]=[]; 

  constructor(private modalCtrl: ModalController,) { }

  ngOnInit() {
    const jLabels = JSON.parse(this.xLabels);
    for (const key in jLabels) {
      if (jLabels.hasOwnProperty(key)) {
        this.aLabels.push(jLabels[key]);
      }
    }
    this.fLabels=[...this.aLabels];
  }

  onChange(value) {
    const query = value.toLowerCase();
    this.fLabels = this.aLabels.filter(label =>label.toLowerCase().indexOf(query) > -1 )
  }
  onClose() {
    const returnData = {
      screenStatus: this.screenStatus
    };
    this.modalCtrl.dismiss(returnData);
  }
}
