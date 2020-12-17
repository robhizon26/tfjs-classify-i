import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
})
export class AboutComponent implements OnInit {
  @Input() screenStatus: string;
  @Input() videoDim: any;
  @Input() model: any;
  constructor(private modalCtrl: ModalController) { }

  ngOnInit() {
      if (this.model)this.model = JSON.parse(this.model)
  }
  onClose() {
    const returnData = {
      screenStatus: this.screenStatus
    };
    this.modalCtrl.dismiss(returnData);
  }
}
