import { Component, ViewEncapsulation } from '@angular/core';
import { HeaderComponent } from '../header/header.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute } from '@angular/router';
import { Point } from '../../models/point.model';

declare const L: any;
declare var markWidth: number;

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [HeaderComponent, TranslateModule],
  templateUrl: './map.component.html',
  styleUrls: [
    './map.component.inventory.base.scss',
    './map.component.inventory.items.scss',
    './map.component.inventory.quest.scss',
    './map.component.inventory.artefacts.scss',
    './map.component.inventory.weapon.scss',
    './map.component.inventory.hovers.scss',
    './map.component.scss'
  ],
  encapsulation: ViewEncapsulation.None,
})

export class MapComponent {
  public readonly game: string;

  private readonly avaliableGames: string[] = ["shoc", "cs", "cop"];
  private readonly defaultGame: string = "shoc";

  private gamedata: any;
  private map: any;
  private locations: any;
  private canvasLayer: any;
  private layers: any[] = [];

  constructor(
    private translate: TranslateService,
    private route: ActivatedRoute,
  ) {
    let urlGame: string = this.route.snapshot.paramMap.get('game') as string;

    if (this.avaliableGames.includes(urlGame)) {
      this.game = urlGame;
    }
    else {
      this.game = this.defaultGame;
    }
  }

  public showHideAll(n: any = null) {
    let i = Object.values(this.layers);
    if (n.target.checked) {
      for (let o of i) {
        this.map.addLayer(o);
        o.show(o);
      }
    }
    else {
      for (let o of i) {
        this.map.removeLayer(o);
        o.hide(o);
      }
    }
}

  private async ngOnInit(): Promise<void> {
    if (typeof L === 'undefined') {
      await this.addScript("/assets/libs/leaflet/index.js");
      await this.addScript("/assets/libs/leaflet/leaflet.js");
      await this.addScript("https://unpkg.com/rbush@3.0.1/rbush.js");
      await this.addScript("/assets/libs/leaflet/plugins/leaflet-markers-canvas.js");
      await this.addScript("/assets/libs/leaflet/plugins/search/leaflet-search.js");
      await this.addScript("/assets/libs/leaflet/plugins/search/leaflet-search-geocoder.js");
      console.log("Leaflet is loaded");
    }

    await Promise.all([this.addStyle("/assets/libs/leaflet/leaflet.css"), this.addStyle("/assets/libs/leaflet/plugins/search/leaflet-search.css"), this.addStyle("/assets/libs/leaflet/plugins/search/leaflet-search.mobile.css")]);

    fetch(`/assets/data/${this.game}/${this.translate.currentLang}.json`)
      .then(response => response.json())
      .then(
        (gamedata: any) => {
          fetch(`/assets/data/${this.game}/config.json`)
            .then(response => response.json())
            .then(
              (gameConfig: any) => {
                this.loadMap(gamedata, gameConfig);
              }
            )
        }
      )
  }

  private async ngOnDestroy(): Promise<void> {
    if (this.map) {
      console.log("remove");
      this.map.remove();
      this.map = null;
    }
  }

  private loadMap(gameData: any, gameConfig: any): void {
    this.gamedata = gameData;
    this.map = L.map("map", {
      center: [gameData.heightInPixels / 2, gameData.widthInPixels / 2],
      zoom: 1,
      minZoom: 0,
      maxZoom: 3,
      crs: L.CRS.Simple,
      markerZoomAnimation: !0,
      zoomAnimation: !0,
      zoomControl: !1
    });

    let bounds = [[0, 0], [this.gamedata.heightInPixels, this.gamedata.widthInPixels]];
    L.imageOverlay(`/assets/images/maps/${this.gamedata.name}/global_map.png`, bounds).addTo(this.map);
    this.map.fitBounds(bounds);
    markWidth = Math.exp(1.3615 + .6117 * this.map.getZoom());
    document.documentElement.style.setProperty(`--map-mark-width`, `${markWidth}px`);
    this.map.setMaxBounds(bounds);

    this.canvasLayer = new L.MarkersCanvas();
    this.canvasLayer.addTo(this.map);

    this.map.redraw = () => {
        this.canvasLayer.redraw();
    }

    this.map.on("zoomend", ()=>{
      markWidth = 3 * Math.pow(2, this.map.getZoom())
      document.documentElement.style.setProperty(`--map-mark-width`, `${markWidth}px`);
    });

    if (this.gamedata.localizedLocations && this.gamedata.localizedLocations.length > 0) {
      this.addLocations();
    }

    if (this.gamedata.marks && this.gamedata.marks.length > 0) {
      this.addMarks();
    }

    if (this.gamedata.stuffs && this.gamedata.stuffs.length > 0) {
      this.addStuffs();
    }

    if (this.gamedata.anomalyZones && this.gamedata.anomalyZones.length > 0 ) {
      this.addAnomalyZones();
    }

    let layerControl = L.control.layers(null, this.layers).addTo(this.map)
    /*let layerControl = L.control.layers(null);

    for (let layer of Object.values(this.layers)) {
      console.log(layer);
      layerControl.addOverlay(layer, layer.markers[0].properties.typeUniqueName);
    }

    layerControl.addTo(this.map);*/

    this.map.on('drag', () => {
      this.map.panInsideBounds(bounds, { animate: false });
    });

    let searchLayers = L.featureGroup(Object.values(this.layers));

    let searchContoller = L.control.search({
        layer: searchLayers,
        initial: false,
        propertyName: 'search',
        delayType: 0,
        collapsed: false,
        autoCollapseTime: 10000,
        buildTip: function (text: string, val: any) {
            let type = val.layer.properties.markType;
            let name = val.layer.properties.name;
            let locationName = val.layer.properties.locationName;
            return '<a href="#"><span class="stalker-search-item ' + type + '">' + name + '</span> <b>(' + locationName + ')</b></a>';
        }
    });

    searchContoller.on('search:locationfound', function (e: { layer: { openPopup: () => void; }; }) {
        e.layer.openPopup();
    });

    this.map.addControl(searchContoller);

    L.control.zoom({
        position: 'bottomright'
    }).addTo(this.map);

    let carousel = document.getElementById("layers-control") as HTMLElement;

    carousel.addEventListener("wheel", function (e) {
        if (e.deltaY > 0) carousel.scrollLeft += 100;
        else carousel.scrollLeft -= 100;
    });

    this.route.queryParams.subscribe((h: any)=>{
        if (h.lat != null && h.lng != null) {
            if (this.map.flyTo([h.lat, h.lng], this.map.getMaxZoom(), {
                animate: !0,
                duration: .3
            }),
            h.type) {
                let m = this.layers[this.translate.instant(h.type)].markers.find((y: { _latlng: { lat: number; lng: number; }; })=>Math.abs(y._latlng.lat - h.lat) < 1 && Math.abs(y._latlng.lng - h.lng) < 1);
                if (m) {
                    m.fireEvent("click");
                    return
                }
            }
        } else
            this.map.setView([this.gamedata.heightInPixels / 2, this.gamedata.widthInPixels / 2])
    });
  }

  private addLocations() {
    let locationsOnMap = [];
    for (let location of this.gamedata.localizedLocations) {
      let locationImage = `/assets/images/maps/${this.gamedata.name}/map_${location.uniqueName}.png`;
      let locationBounds = [[location.y1, location.x1], [location.y2, location.x2]];
      let locationImageOverlay = L.imageOverlay(locationImage, locationBounds, {
        interactive: !0,
        className: "location-on-map"
      });

      locationImageOverlay.name = location.name;
      locationImageOverlay.id = location.id;
      locationsOnMap.push(locationImageOverlay);
    }

    this.locations = L.layerGroup(locationsOnMap);
    this.locations.locations = Object.values(locationsOnMap);
    this.locations.addTo(this.map);
  }

  private addMarks() {
    let markTypes = [{
      id: 0,
      ableToSearch: !0,
      name: "none"
    }, {
      id: 1,
      ableToSearch: !0,
      name: this.translate.instant("sub-location"),
      uniqueName: "sub-location",
      icon: L.icon({
        iconSizeInit: [4, 4],
        className: "mark-container stalker-mark-4",
        animate: !1,
        iconUrl: "/assets/images/svg/marks/sub-location.svg",
        iconAnchor: [0, 0]
      })
    }, {
      id: 100,
      name: this.translate.instant("acidic"),
      uniqueName: "acidic",
      icon: L.icon({
        iconSizeInit: [2, 2],
        className: "mark-container stalker-mark-2",
        animate: !1,
        iconUrl: "/assets/images/svg/marks/chemical.svg",
        iconAnchor: [0, 0]
      })
    }, {
      id: 101,
      name: this.translate.instant("psychic"),
      uniqueName: "psychic",
      icon: L.icon({
        iconSizeInit: [2, 2],
        className: "mark-container stalker-mark-2",
        animate: !1,
        iconUrl: "/assets/images/svg/marks/psi.svg",
        iconAnchor: [0, 0]
      })
    }, {
      id: 102,
      name: this.translate.instant("radioactive"),
      uniqueName: "radioactive",
      icon: L.icon({
        iconSizeInit: [2, 2],
        className: "mark-container stalker-mark-2",
        animate: !1,
        iconUrl: "/assets/images/svg/marks/radiation.svg",
        iconAnchor: [0, 0]
      })
    }, {
      id: 103,
      name: this.translate.instant("thermal"),
      uniqueName: "thermal",
      icon: L.icon({
        iconSizeInit: [2, 2],
        className: "mark-container stalker-mark-2",
        animate: !1,
        iconUrl: "/assets/images/svg/marks/fire.svg",
        iconAnchor: [0, 0]
      })
    }, {
      id: 200,
      name: this.translate.instant("teleport"),
      uniqueName: "teleport",
      icon: L.icon({
        iconSizeInit: [2, 2],
        className: "mark-container stalker-mark-2",
        animate: !1,
        iconUrl: "/assets/images/svg/marks/portal.svg",
        iconAnchor: [0, 0]
      })
    }, {
      id: 201,
      name: this.translate.instant("mines"),
      uniqueName: "mines",
      icon: L.icon({
        iconSizeInit: [1.5, 1.5],
        className: "mark-container stalker-mark-1.5",
        animate: !1,
        iconUrl: "/assets/images/svg/marks/mines.svg",
        iconAnchor: [0, 0]
      })
    }];

    this.gamedata.marks = this.gamedata.marks.sort((c: { typeId: number; }, l: { typeId: number; }) => c.typeId - l.typeId);
    for (let markType of markTypes) {
      let marks = this.gamedata.marks.filter((u: { typeId: number; }) => u.typeId == markType.id);

      if (marks.length > 0) {
        let geoMarks: any = {};
        geoMarks.type = "FeatureCollection";
        geoMarks.features = [];

        for (let mark of marks) {
          let marker = L.marker([mark.y, mark.x], {
            icon: markType.icon
          });

          marker.properties = {};
          marker.properties.name = mark.name;
          marker.properties.description = mark.description;
          marker.properties.markType = markType.name;
          marker.properties.typeUniqueName = markType.uniqueName;
          marker.properties.ableToSearch = markType.ableToSearch;

          if (marker.properties.ableToSearch) {

            let p = [];

            p.push(marker.properties.name);

            if (marker.properties.description != this.translate.instant("default-desription")) {
              p.push(marker.properties.description);
            }

            p.push(mark.id);
            marker.feature = {
              properties: {
                search: p.join(", ")
              }
            };

            marker.properties.locationName = this.locations.locations.find((y: { id: any; }) => y.id == mark.locationId);
          }

          marker.bindTooltip(marker.properties.name, {
            sticky: true,
            className: "map-tooltip",
            offset: [0, 50]
          });
            geoMarks.features.push(marker)

            //marker.addTo(this.map);
        }
        /*let d = !0;
        if (s.markersConfig?.length > 0) {
          let f = s.markersConfig.filter(h => h.uniqueName == markType.uniqueName);
          f.length > 0 && (d = f[0].isShow)
        }
        this.addToCanvas(markModel, markType, d)*/
        this.addToCanvas(geoMarks, markType);
      }
    }
  }

  private addStuffs() {
      let stuffTypes = [{
          id: 0,
          ableToSearch: !0,
          itemableToSearch: !0,
          name: this.translate.instant("stash"),
          uniqueName: "stash",
          icon: L.icon({
              iconSizeInit: [1, 1],
              className: "mark-container stalker-mark",
              animate: !1,
              iconUrl: "/assets/images/svg/marks/stash.svg",
              iconAnchor: [0, 0]
          })
      }, {
          id: 1,
          ableToSearch: !0,
          itemableToSearch: !0,
          name: this.translate.instant("quest"),
          uniqueName: "quest",
          icon: L.icon({
              iconSizeInit: [1, 1],
              className: "mark-container stalker-mark",
              animate: !1,
              iconUrl: "/assets/images/svg/marks/quest-item.svg",
              iconAnchor: [0, 0]
          })
      }, {
          id: 2,
          ableToSearch: !0,
          itemableToSearch: !0,
          name: this.translate.instant("destroyable-box"),
          uniqueName: "destroyable-box",
          icon: L.icon({
              iconSizeInit: [1, 1],
              className: "mark-container stalker-mark",
              animate: !1,
              iconUrl: "/assets/images/svg/marks/items.svg",
              iconAnchor: [0, 0]
          })
      }, {
          id: 3,
          ableToSearch: !0,
          itemableToSearch: !0,
          name: this.translate.instant("stuff"),
          uniqueName: "stuff",
          icon: L.icon({
              iconSizeInit: [1, 1],
              className: "mark-container stalker-mark",
              animate: !1,
              iconUrl: "/assets/images/svg/marks/stuff.svg",
              iconAnchor: [0, 0]
          })
      }];

      this.gamedata.stuffs = this.gamedata.stuffs.sort((c: { typeId: number; },l: { typeId: number; })=>c.typeId - l.typeId);
      for (let markType of stuffTypes) {
          let stuffsAtLocation = this.gamedata.stuffs.filter((u: { typeId: number; })=>u.typeId == markType.id);

          if (stuffsAtLocation.length > 0) {
              let geoMarks: any = {};
              geoMarks.type = "FeatureCollection";
              geoMarks.features = [];

              for (let f of stuffsAtLocation) {
                  let stuff = L.marker([f.y, f.x], {
                      icon: markType.icon
                  });

                  stuff.properties = {};
                  stuff.properties.name = f.name;
                  stuff.properties.description = f.description;
                  stuff.properties.items = f.items;
                  stuff.properties.markType = markType.name;
                  stuff.properties.typeUniqueName = markType.uniqueName;
                  stuff.properties.ableToSearch = markType.ableToSearch;

                  if (stuff.properties.ableToSearch) {
                      let p = [];
                      p.push(stuff.properties.name);
                      stuff.properties.description != this.translate.instant("default-desription") && p.push(stuff.properties.description);
                      p.push(stuff.properties.items.map((y: { item: { name: any; }; })=>y.item.name));
                      p.push(f.id);

                      stuff.feature = {
                          properties: {
                              search: p.join(", ")
                          }
                      };
                      stuff.properties.locationName = this.locations.locations.find((y: { id: any; })=>y.id == f.locationId);
                  }

                  stuff.bindTooltip((p: any) =>this.createStuffTooltip(p), {
                      sticky: true,
                      className: "map-tooltip",
                      offset: new Point(0,50)
                  });
                  stuff.bindPopup((p: any) =>this.createStashPopup(p)).openPopup(),
                  geoMarks.features.push(stuff)
                  //stuff.addTo(this.map);
              }

              /*if (s.markersConfig?.length > 0) {
                  let f = s.markersConfig.filter(h=>h.uniqueName == c.uniqueName);
                  f.length > 0 && (d = f[0].isShow)
              }
              this.addToCanvas(stuffMark, c, d)*/
              this.addToCanvas(geoMarks, markType);
          }
      }
  }

  private createStuffTooltip(stuff: { properties: { name: any; description: any; }; description: any; }) {
    let html = `<div class="header-tip"><p class="p-header">${stuff.properties.name}</p></div>`;
    if (stuff.description) {
        html += `<div class="tooltip-text"><p>${stuff.properties.description}</p></div>`;
    }

    return html;
  }

  private createStashPopup(stash: {
    _latlng: any; properties: {
    typeUniqueName: any; name: any; description: any; items: any[];
}; }) {
      let descHtml = `<div><div class='popup header'>${stash.properties.name}</div><div class='popup description'>${stash.properties.description}</div></div>`

      let inventoryItemsHtml = '<div class="inventory">';

      let sortedItems = stash.properties.items.sort(function(a, b) {
          return -(a.item.width - b.item.width || a.item.area - b.item.area);
      });

      for (let stuffItem of sortedItems) {
          inventoryItemsHtml += `<div class="inventory-item inventory-item-width-${stuffItem.item.width} inventory-item-height-${stuffItem.item.height}">`;

          if (stuffItem.count > 1 || stuffItem.isUnique) {
              inventoryItemsHtml += '<div class="item-additional-info">';

              if (stuffItem.count > 1) {
                inventoryItemsHtml += `<div class="inventory-item-count">${stuffItem.count}</div>`;
              }

              if (stuffItem.isUnique) {
                inventoryItemsHtml += `<div class="inventory-item-upgrade"></div>`;
              }

              inventoryItemsHtml += '</div>';
          }

          inventoryItemsHtml += `<div class="inventory-item-image ${stuffItem.item.uniqueName} ${this.gamedata.name}" title="${stuffItem.item.name}"></div></div>`;
      }

      inventoryItemsHtml += `</div>`;
      inventoryItemsHtml += `<div class="bottom"><div link-uniqueName="${stash.properties.typeUniqueName}" link-lng="${stash._latlng.lng}" link-lat="${stash._latlng.lat}" link-game="${this.gamedata.name}" class="button url-button" onclick="copyLink(this)"><span>Mark link</span></div></div>`;

      return descHtml + inventoryItemsHtml;
  }

  private addAnomalyZones() {
    let anomalyZoneIcon = { name: this.translate.instant("anomaly-zone"), cssClass: "anomaly-zone", ableToSearch: true, icon: L.icon({ iconSize: [4, 4], className: 'mark-container stalker-mark-2', animate: false, iconUrl: '/assets/images/svg/marks/anomaly.svg', iconSizeInit: [2, 2], iconAnchor: [0, 0] }) };
    let anomalyZoneNoArtIcon = { name: this.translate.instant("anomaly-zone-no-art"), icon: L.icon({ iconSize: [12.5, 12.5], className: 'mark-container stalker-mark', animate: false, iconUrl: '/assets/images/svg/marks/anomaly_noart.svg', iconSizeInit: [1, 1], iconAnchor: [0, 0] }) };
    let anomalies: any = {};
    let anomaliesNoArt: any = {};
    anomalies.type = "FeatureCollection";
    anomaliesNoArt.type = "FeatureCollection";
    anomalies.features = [];
    anomaliesNoArt.features = [];

    for (let zone of this.gamedata.anomalyZones) {
        let canvasMarker;
        if (zone.anomaliySpawnSections != null && zone.anomaliySpawnSections.length > 0) {
            canvasMarker = L.marker([zone.y, zone.x], {icon: anomalyZoneIcon.icon});
        }
        else {
            canvasMarker = L.marker([zone.y, zone.x], {icon: anomalyZoneNoArtIcon.icon});
        }

        canvasMarker.properties = {};
        canvasMarker.properties.name = zone.name;
        canvasMarker.properties.description = zone.description;

        if (zone.anomaliySpawnSections != null && zone.anomaliySpawnSections.length > 0) {
            canvasMarker.properties.anomaliySpawnSections = zone.anomaliySpawnSections;
            canvasMarker.properties.markType = anomalyZoneIcon.cssClass;
            canvasMarker.properties.ableToSearch = true;
            canvasMarker.properties.typeUniqueName = "anomaly-zone";

            let searchFields = [];
            searchFields.push(canvasMarker.properties.name);

            if (canvasMarker.properties.description != this.translate.instant("default-desription")) {
                searchFields.push(canvasMarker.properties.description);
            }

            searchFields.push(zone.anomaliySpawnSections.map((item: { anomalySpawnItems: any[]; }) => item.anomalySpawnItems.map(ass => ass.artefact.name)));
            searchFields.push(zone.id);
            canvasMarker.feature = { properties: {search: searchFields.join(', ')}}
            anomalies.features.push(canvasMarker);

            let location = canvasMarker.properties.locationName = this.locations.locations.find((x: { id: any; }) => x.id == zone.locationId);
            if (location) {
                canvasMarker.properties.locationName = location.name;
            }
        }
        else {
            anomaliesNoArt.features.push(canvasMarker);
            canvasMarker.properties.ableToSearch = false;
        }

        canvasMarker.bindTooltip((zone: any) => { return this.createAnomalyZoneTooltip(zone) }, { sticky: true, className: "map-tooltip", offset: new Point(0, 50) });
        canvasMarker.bindPopup((zone: any) => this.createeAnomalyZonePopup(zone)).openPopup();
    }

    try {
      this.addToCanvas(anomalies, anomalyZoneIcon);

      if (anomaliesNoArt.features.length > 0) {
        this.addToCanvas(anomaliesNoArt, anomalyZoneNoArtIcon);
      }
    }
    catch (e) {
        console.log(e);
    }
  }

  private addToCanvas(geoMarks: any, markType: any) {
      let marksLayer = L.geoJSON(geoMarks);
      marksLayer.ableToSearch = markType.ableToSearch ?? false;
      marksLayer.isShowing = false;
      marksLayer.markers = geoMarks.features;
      this.layers[markType.name] = marksLayer;

      marksLayer.hide = (layer: { isShowing: boolean; markers: any; }) => {
          if (layer.isShowing) {
            this.canvasLayer.removeMarkers(layer.markers);

              layer.isShowing = false;
          }
      }

      marksLayer.show = (layer: { isShowing: boolean; markers: any; }) => {
          if (!layer.isShowing) {
              this.canvasLayer.addMarkers(layer.markers);

              layer.isShowing = true;
          }
      }

      marksLayer.show(marksLayer);
  }

  private createAnomalyZoneTooltip(zone: { properties: { name: any; description: any; }; description: any; }) {
      let html = `<div class="header-tip"><p class="p-header">${zone.properties.name}</p></div>`;
      if (zone.description) {
          html += `<div class="tooltip-text"><p>${zone.properties.description}</p></div>`;
      }

      return html;
  }

  private createeAnomalyZonePopup(zone: {
    _latlng: any; properties: {
    typeUniqueName: any; name: any; description: any; anomaliySpawnSections: any[];
}; }) {
      let descHtml = `<div><div class='popup header'>${zone.properties.name}</div><div class='popup description'>${zone.properties.description}</div></div>`

      if (zone.properties.anomaliySpawnSections && zone.properties.anomaliySpawnSections.length > 0) {
          let sectionsHtml = '<div class="sections">';

          let sortedSections = zone.properties.anomaliySpawnSections.sort(function (a, b) {
              return -(a.Sort - b.Sort);
          });

          let maxArtefactsInZone = 0;

          for (let section of sortedSections) {
              if (section.anomalySpawnItems && section.anomalySpawnItems.length > 0) {
                  if (section.count == 0) {
                      section.count = 1;
                  }
                  let anomalyCountSection = section.count > 1 ? `<div>${this.translate.instant('anomaliesCount', {count: section.count})}</div>` : '';
                  sectionsHtml += `<div class='section'><div class='anomaly-section-info'>${anomalyCountSection}<div>${this.translate.instant('anomalyArtMaxCount', {count: section.maxCapacity})}</div></div>`;
                  sectionsHtml += `<div class="inventory">`;
                  let items = section.anomalySpawnItems.sort(function (a: { probability: number; }, b: { probability: number; }) {
                      return -(a.probability - b.probability);
                  });

                  for (let item of items) {
                      sectionsHtml += `<div class="inventory-item inventory-item-width-1 inventory-item-height-1">`
                      sectionsHtml += `<div class="inventory-item-percentage">${Math.floor(item.probability * 100)}%</div>`;
                      sectionsHtml += `<div class="inventory-item-image ${item.artefact.uniqueName} ${this.gamedata.name}" title="${item.artefact.name}"></div></div>`;
                  }

                  sectionsHtml += '</div></div>';
                  maxArtefactsInZone += section.count * section.maxCapacity;
              }
          }

          sectionsHtml += `</div><div class='anomaly-section-info'>${this.translate.instant('anomalyZoneArtMaxCount', {count: maxArtefactsInZone})}</div>`

          descHtml += sectionsHtml;
          descHtml += `<div class="bottom"><div link-uniqueName="${zone.properties.typeUniqueName}" link-lng="${zone._latlng.lng}" link-lat="${zone._latlng.lat}" link-game="${this.gamedata.name}" class="button url-button" onclick="copyLink(this)"><span>Mark link</span></div></div>`;
      }

      return descHtml;
  }

  private async addScript(scriptUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let script = document.createElement("script");
      script.type = "text/javascript";
      script.src = scriptUrl;
      document.body.appendChild(script);
      script.onload = () => {
        console.log(`${scriptUrl} is loaded.`);
        resolve();
      }
    });
  }


  private async addStyle(styleUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let style = document.createElement("link");
      style.rel = "stylesheet";
      style.href = styleUrl;
      document.body.appendChild(style);
      style.onload = () => {
        console.log(`${styleUrl} is loaded.`);
        resolve();
      }
    });
  }
}
