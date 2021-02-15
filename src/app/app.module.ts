import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';

import { AppComponent } from './app.component';
import { HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ClassesComponent } from './modals/classes/classes.component';
import { AboutComponent } from './modals/about/about.component';
import { ModelsComponent } from './modals/models/models.component';
import { SettingsComponent } from './modals/settings/settings.component';

@NgModule({
  declarations: [AppComponent, ClassesComponent, AboutComponent, ModelsComponent, SettingsComponent],
  entryComponents: [ClassesComponent, AboutComponent, ModelsComponent],
  imports: [BrowserModule, IonicModule, IonicModule.forRoot(), HttpClientModule, CommonModule],
  providers: [
    StatusBar,
    SplashScreen,
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy } 
  ],
  bootstrap: [AppComponent],
})
export class AppModule { }
