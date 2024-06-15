import {
  Component,
  ComponentFactoryResolver,
  HostListener,
  ViewEncapsulation,
  ViewContainerRef,
  ViewChild,
} from '@angular/core';
import { HeaderComponent } from '../header/header.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute } from '@angular/router';
import { Point } from '../../models/point.model';
import { getAnalytics, logEvent } from 'firebase/analytics';
import { TraderModel } from '../../models/trader/trader.model';
import { TraderComponent } from '../trader/trader.component';
import { StuffComponent } from '../stuff/stuff.component';
import { AnomalyZoneComponent } from '../anomaly-zone/anomaly-zone.component';
import { Item } from '../../models/item.model';
import { Map } from '../../models/map.model';
import { StuffModel } from '../../models/stuff';
import { Location } from '../../models/location.model';
import { LootBoxConfig } from '../../models/loot-box-config.model';
import { LootBoxSection } from '../../models/loot-box-section.model';

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
    './map.component.scss',
  ],
  encapsulation: ViewEncapsulation.None,
})
export class MapComponent {
  @ViewChild('dynamicComponents', { read: ViewContainerRef })
  container: ViewContainerRef;

  public readonly game: string;

  private readonly avaliableGames: string[] = [
    'shoc',
    'cs',
    'cop',
    's2_2011',
    'hoc',
  ];
  private readonly defaultGame: string = 'shoc';

  private gamedata: any;
  private map: any;
  private locations: any;
  private canvasLayer: any;
  private layers: any[] = [];
  private items: Item[];
  private lootBoxConfig: LootBoxConfig;

  constructor(
    private translate: TranslateService,
    private route: ActivatedRoute,
    private resolver: ComponentFactoryResolver
  ) {
    let urlGame: string = this.route.snapshot.paramMap.get('game') as string;

    if (this.avaliableGames.includes(urlGame)) {
      this.game = urlGame;
    } else {
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
    } else {
      for (let o of i) {
        this.map.removeLayer(o);
        o.hide(o);
      }
    }
  }

  @HostListener('window:resize', ['$event'])
  private onResize(event: any) {
    let vh = event.target.outerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);

    let wrapper = document.getElementById('map-wrapper');

    if (wrapper) {
      let wrapperHeight = event.target.innerHeight - wrapper.offsetTop - 10;
      document.documentElement.style.setProperty(
        '--wrapper-height',
        `${wrapperHeight}px`
      );
    }
  }

  private async ngOnInit(): Promise<void> {
    if (typeof L === 'undefined') {
      await this.addScript('/assets/libs/leaflet/index.js');
      await this.addScript('/assets/libs/leaflet/leaflet.js');
      await this.addScript('/assets/libs/leaflet/plugins/rbush.js');
      await this.addScript(
        '/assets/libs/leaflet/plugins/leaflet-markers-canvas.js'
      );
      await this.addScript(
        '/assets/libs/leaflet/plugins/search/leaflet-search.js'
      );
      await this.addScript(
        '/assets/libs/leaflet/plugins/search/leaflet-search-geocoder.js'
      );
      await this.addScript(
        '/assets/libs/leaflet/plugins/ruler/leaflet-ruler.js'
      );
      console.log('Leaflet is loaded');
    }

    await Promise.all([
      this.addStyle('/assets/libs/leaflet/leaflet.css'),
      this.addStyle('/assets/libs/leaflet/plugins/search/leaflet-search.css'),
      this.addStyle(
        '/assets/libs/leaflet/plugins/search/leaflet-search.mobile.css'
      ),
      this.addStyle('/assets/libs/leaflet/plugins/ruler/leaflet-ruler.css'),
      await this.loadLocales(this.translate.currentLang),
      await this.loadItems(),
      await this.loadLootBoxConfig()
    ]);

    this.translate.onLangChange.subscribe((i) => {
      this.loadLocales(i.lang);
    });

    fetch(`/assets/data/${this.game}/map.json`)
      .then((response) => response.json())
      .then((gamedata: Map) => {
        fetch(`/assets/data/${this.game}_config.json`)
          .then((response) => response.json())
          .then((gameConfig: any) => {
            this.loadMap(gamedata, gameConfig);
          });
      });

    let body = document.body,
      html = document.documentElement;

    let height = Math.max(
      body.scrollHeight,
      body.offsetHeight,
      html.clientHeight,
      html.scrollHeight,
      html.offsetHeight
    );

    let wrapper = document.getElementById('map-wrapper');

    if (wrapper) {
      let wrapperHeight = height - wrapper.offsetTop - 10;
      document.documentElement.style.setProperty(
        '--wrapper-height',
        `${wrapperHeight}px`
      );
    }
  }

  private async loadItems(): Promise<void> {
    await fetch(`/assets/data/${this.game}/items.json`)
      .then((response) => response.json())
      .then((items: Item[]) => {
        if (items) {
          this.items = items;
        }
        console.log(items);
      });
  }

  private async loadLootBoxConfig(): Promise<void> {
    await fetch(`/assets/data/${this.game}/lootBoxConfig.json`)
      .then((response) => response.json())
      .then((config: LootBoxConfig) => {
        if (config) {
          this.lootBoxConfig = config;
        }
        console.log(config);
      });
  }

  private async loadLocales(language: string): Promise<void> {
    await fetch(`/assets/data/${this.game}/${this.translate.currentLang}.json`)
      .then((response) => response.json())
      .then((locales: any) => {
        if (locales) {
          this.translate.setTranslation(language, locales, true);
        }
        console.log(locales);
      });
  }

  private async ngOnDestroy(): Promise<void> {
    if (this.map) {
      console.log('remove');
      this.map.remove();
      this.map = null;
    }
  }

  private loadMap(gameData: Map, gameConfig: any): void {
    this.gamedata = gameData;

    this.map = L.map('map', {
      center: [gameData.heightInPixels / 2, gameData.widthInPixels / 2],
      zoom: 1,
      minZoom: gameConfig.minZoom,
      maxZoom: gameConfig.maxZoom,
      crs: L.CRS.Simple,
      markerZoomAnimation: !0,
      zoomAnimation: !0,
      zoomControl: !1,
    });

    let bounds = [
      [0, 0],
      [this.gamedata.heightInPixels, this.gamedata.widthInPixels],
    ];
    L.imageOverlay(
      `/assets/images/maps/${this.gamedata.uniqueName}/${gameConfig.globalMapFileName}`,
      bounds
    ).addTo(this.map);
    this.map.fitBounds(bounds);

    markWidth = Math.exp(1.3615 + 0.6117 * this.map.getZoom());
    document.documentElement.style.setProperty(
      `--map-mark-width`,
      `${markWidth}px`
    );

    this.map.on('zoomend', () => {
      markWidth = 3 * Math.pow(2, this.map.getZoom());
      document.documentElement.style.setProperty(
        `--map-mark-width`,
        `${markWidth}px`
      );
    });

    this.map.setMaxBounds(bounds);

    this.canvasLayer = new L.MarkersCanvas();
    this.canvasLayer.addTo(this.map);

    this.map.redraw = () => {
      this.canvasLayer.redraw();
    };

    if (this.gamedata.locations && this.gamedata.locations.length > 0) {
      this.addLocations();
      let marks = '';

      for (let location of this.gamedata.locations) {
        if (
          this.translate.instant(location.uniqueName) == location.uniqueName
        ) {
          marks += `"${location.uniqueName}",`;
        }
      }

      if (marks) {
        console.error(marks);
      }
    }

    if (this.gamedata.stuffs && this.gamedata.stuffs.length > 0) {
      this.addStuffs();
      let marks = '';

      for (let stuff of this.gamedata.stuffs) {
        if (stuff.name) {
          if (this.translate.instant(stuff.name) == stuff.name) {
            marks += `"${stuff.name}",`;
          }

          if (stuff.description) {
            if (this.translate.instant(stuff.description) == stuff.description) {
              marks += `"${stuff.description}",`;
            }
          }
        }
      }

      if (marks) {
        console.error(marks);
      }
    }
  }

  private loadMap_old(gameData: any, gameConfig: any): void {
    this.gamedata = gameData;
    this.map = L.map('map', {
      center: [gameData.heightInPixels / 2, gameData.widthInPixels / 2],
      zoom: 1,
      minZoom: gameConfig.minZoom,
      maxZoom: gameConfig.maxZoom,
      crs: L.CRS.Simple,
      markerZoomAnimation: !0,
      zoomAnimation: !0,
      zoomControl: !1,
    });

    let bounds = [
      [0, 0],
      [this.gamedata.heightInPixels, this.gamedata.widthInPixels],
    ];
    L.imageOverlay(
      `/assets/images/maps/${this.gamedata.uniqueName}/${gameConfig.globalMapFileName}`,
      bounds
    ).addTo(this.map);
    this.map.fitBounds(bounds);
    markWidth = Math.exp(1.3615 + 0.6117 * this.map.getZoom());
    document.documentElement.style.setProperty(
      `--map-mark-width`,
      `${markWidth}px`
    );
    this.map.setMaxBounds(bounds);

    this.canvasLayer = new L.MarkersCanvas();
    this.canvasLayer.addTo(this.map);

    this.map.redraw = () => {
      this.canvasLayer.redraw();
    };

    this.map.on('zoomend', () => {
      markWidth = 3 * Math.pow(2, this.map.getZoom());
      document.documentElement.style.setProperty(
        `--map-mark-width`,
        `${markWidth}px`
      );
    });

    if (this.gamedata.locations && this.gamedata.locations.length > 0) {
      this.addLocations();
      let marks = '';

      for (let location of this.gamedata.locations) {
        if (
          this.translate.instant(location.uniqueName) == location.uniqueName
        ) {
          marks += `"${location.uniqueName}",`;
        }
      }

      if (marks) {
        console.error(marks);
      }
    }

    if (this.gamedata.marks && this.gamedata.marks.length > 0) {
      this.addMarks();
      let marks = '';
      for (let mark of this.gamedata.marks) {
        if (this.translate.instant(mark.name) == mark.name) {
          marks += `"${mark.name}",`;
        }
        if (
          mark.description &&
          this.translate.instant(mark.description) == mark.description
        ) {
          marks += `"${mark.description}",`;
        }
      }

      if (marks) {
        console.error(marks);
      }
    }

    if (this.gamedata.stuffs && this.gamedata.stuffs.length > 0) {
      this.addStuffs_old();
      let marks = '';

      for (let stuff of this.gamedata.stuffs) {
        if (this.translate.instant(stuff.name) == stuff.name) {
          marks += `"${stuff.name}",`;
        }
        if (this.translate.instant(stuff.description) == stuff.description) {
          marks += `"${stuff.description}",`;
        }
      }

      if (marks) {
        console.error(marks);
      }
    }

    if (this.gamedata.anomalyZones && this.gamedata.anomalyZones.length > 0) {
      this.addAnomalyZones();

      let marks = '';
      for (let mark of this.gamedata.anomalyZones) {
        if (mark.name && this.translate.instant(mark.name) == mark.name) {
          marks += `"${mark.name}",`;
        }
        if (
          mark.description &&
          this.translate.instant(mark.description) == mark.description
        ) {
          marks += `"${mark.description}",`;
        }
      }

      if (marks) {
        console.error(marks);
      }
    }

    if (this.gamedata.traders && this.gamedata.traders.length > 0) {
      this.addTraders();
    }

    let layersToHide = [];

    if (
      gameConfig.markersConfig != null &&
      gameConfig.markersConfig.length > 0 &&
      this.layers != null
    ) {
      let allLayers = Object.values(this.layers);
      let newLayers: any = {};
      for (let config of gameConfig.markersConfig) {
        if (allLayers.some((y) => y.name == config.uniqueName)) {
          let currentLayer = allLayers.filter(
            (D) => D.name == config.uniqueName
          )[0];
          newLayers[this.translate.instant(config.uniqueName)] = currentLayer;

          if (!config.isShow) {
            layersToHide.push(currentLayer);
          }
        }
      }

      this.layers = newLayers;
    }

    let layerControl = L.control.layers(null, this.layers).addTo(this.map);

    this.map.on('drag', () => {
      this.map.panInsideBounds(bounds, { animate: false });
    });

    let searchLayers = L.featureGroup(Object.values(this.layers));
    let translate = this.translate;

    let searchContoller = L.control.search({
      layer: searchLayers,
      initial: false,
      propertyName: 'search',
      delayType: 0,
      collapsed: false,
      autoCollapseTime: 10000,
      textPlaceholder: this.translate.instant('search'),
      buildTip: function (text: string, val: any) {
        try {
          let type = val.layer.properties.typeUniqueName;
          let translated = translate.instant(val.layer.properties.name);
          let location = translate.instant(
            val.layer.properties.locationUniqueName
          );
          return (
            '<a href="#"><span class="stalker-search-item ' +
            type +
            '">' +
            translated +
            '</span> <b>(' +
            location +
            ')</b></a>'
          );
        } catch (ex) {
          console.error(text, val);
          throw ex;
        }
      },
    });

    if (gameConfig.rulerEnabled) {
      var options = {
        position: 'topright', // Leaflet control position option
        circleMarker: {
          // Leaflet circle marker options for points used in this plugin
          color: 'red',
          radius: 2,
        },
        lineStyle: {
          // Leaflet polyline options for lines used in this plugin
          color: 'red',
          dashArray: '1,6',
        },
        lengthUnit: {
          factor: gameConfig.lengthFactor, //  from km to nm
          display: this.translate.instant('meterShort'),
          decimal: 2,
          label: this.translate.instant('length'),
        },
        angleUnit: {
          display: '&deg;', // This is the display value will be shown on the screen. Example: 'Gradian'
          decimal: 2, // Bearing result will be fixed to this value.
          factor: null, // This option is required to customize angle unit. Specify solid angle value for angle unit. Example: 400 (for gradian).
          label: this.translate.instant('azimuth'),
        },
      };

      L.control.ruler(options).addTo(this.map);
    }

    searchContoller.on(
      'search:locationfound',
      function (e: { layer: { openPopup: () => void } }) {
        e.layer.openPopup();
      }
    );

    this.map.addControl(searchContoller);

    L.control
      .zoom({
        position: 'bottomright',
      })
      .addTo(this.map);

    let carousel = document.getElementById('layers-control') as HTMLElement;

    carousel.addEventListener('wheel', function (e) {
      if (e.deltaY > 0) carousel.scrollLeft += 100;
      else carousel.scrollLeft -= 100;
    });

    if (layersToHide.length > 0) {
      for (let h of layersToHide) {
        this.map.removeLayer(h);
        h.hide(h);
      }
      this.map.redraw();
    }

    const analytics = getAnalytics();
    logEvent(analytics, 'open-map', {
      game: this.gamedata.name,
      language: this.translate.currentLang,
    });

    this.route.queryParams.subscribe((h: any) => {
      if (h.lat != null && h.lng != null) {
        if (
          (this.map.flyTo([h.lat, h.lng], this.map.getMaxZoom(), {
            animate: !0,
            duration: 0.3,
          }),
          h.type)
        ) {
          let m = this.layers[this.translate.instant(h.type)].markers.find(
            (y: { _latlng: { lat: number; lng: number } }) =>
              Math.abs(y._latlng.lat - h.lat) < 1 &&
              Math.abs(y._latlng.lng - h.lng) < 1
          );
          if (m) {
            m.fireEvent('click');

            logEvent(analytics, 'open-map-queryParams', {
              game: this.gamedata.name,
              language: this.translate.currentLang,
              markType: h.type,
              coordinates: `${h.lat} ${h.lng}`,
            });

            return;
          }
        }
      } else
        this.map.setView([
          this.gamedata.heightInPixels / 2,
          this.gamedata.widthInPixels / 2,
        ]);
    });

    /*this.map.on('click', function(e: { latlng: any; }){
      var coord = e.latlng;
      var lat = coord.lat;
      var lng = coord.lng;
      console.log("You clicked the map at latitude: " + lat + " and longitude: " + lng);
      });*/
  }

  private addLocations() {
    let locationsOnMap = [];
    for (let location of this.gamedata.locations) {
      let locationImage = `/assets/images/maps/${this.gamedata.uniqueName}/map_${location.uniqueName}.png`;
      let locationBounds = [
        [location.y1, location.x1],
        [location.y2, location.x2],
      ];
      let locationImageOverlay = L.imageOverlay(locationImage, locationBounds, {
        interactive: !0,
        className: 'location-on-map',
      });

      locationImageOverlay.name = location.name;
      locationImageOverlay.uniqueName = location.uniqueName;
      locationImageOverlay.id = location.id;
      locationsOnMap.push(locationImageOverlay);
    }

    this.locations = L.layerGroup(locationsOnMap);
    this.locations.locations = Object.values(locationsOnMap);
    this.locations.addTo(this.map);
  }

  private addStuffs() {
    let stuffTypes = [
      {
        id: 0,
        ableToSearch: !0,
        itemableToSearch: !0,
        name: this.translate.instant('stash'),
        uniqueName: 'stash',
        icon: L.icon({
          iconSizeInit: [1, 1],
          className: 'mark-container stalker-mark',
          animate: !1,
          iconUrl: '/assets/images/svg/marks/stash.svg',
          iconAnchor: [0, 0],
        }),
      },
      {
        id: 1,
        ableToSearch: !0,
        itemableToSearch: !0,
        name: this.translate.instant('quest'),
        uniqueName: 'quest',
        icon: L.icon({
          iconSizeInit: [1, 1],
          className: 'mark-container stalker-mark',
          animate: !1,
          iconUrl: '/assets/images/svg/marks/quest-item.svg',
          iconAnchor: [0, 0],
        }),
      },
      {
        id: 2,
        ableToSearch: !0,
        itemableToSearch: !0,
        name: this.translate.instant('destroyable-box'),
        uniqueName: 'destroyable-box',
        icon: L.icon({
          iconSizeInit: [1, 1],
          className: 'mark-container stalker-mark',
          animate: !1,
          iconUrl: '/assets/images/svg/marks/items.svg',
          iconAnchor: [0, 0],
        }),
      },
      {
        id: 3,
        ableToSearch: !0,
        itemableToSearch: !0,
        name: this.translate.instant('stuff'),
        uniqueName: 'stuff',
        icon: L.icon({
          iconSizeInit: [1, 1],
          className: 'mark-container stalker-mark',
          animate: !1,
          iconUrl: '/assets/images/svg/marks/stuff.svg',
          iconAnchor: [0, 0],
        }),
      },
    ];

    this.gamedata.stuffs = this.gamedata.stuffs.sort(
      (c: StuffModel, l: StuffModel) => c.typeId - l.typeId
    );
    for (let markType of stuffTypes) {
      let stuffsAtLocation = this.gamedata.stuffs.filter(
        (u: { typeId: number }) => u.typeId == markType.id
      );

      if (stuffsAtLocation.length > 0) {
        let geoMarks: any = {};
        geoMarks.type = 'FeatureCollection';
        geoMarks.features = [];

        for (let stuffModel of stuffsAtLocation) {
          let location: Location = this.gamedata.locations.find((x: { id: any; }) => x.id == stuffModel.locationId);

          let markerX: number = 0.5 - location.xShift + stuffModel.x / location.widthInMeters;
          let markerY: number = 0.5 - location.yShift + stuffModel.z / location.heightInMeters;

          let dx: number = location.x2 - location.x1;
          let dy: number = location.y1 - location.y2;

          let stuff = L.marker([location.y2 + markerY * dy, location.x1 + markerX * dx], {
            icon: markType.icon,
          });

          stuff.properties = {};
          stuff.properties.stuff = stuffModel;
          stuff.properties.markType = markType.name;
          stuff.properties.typeUniqueName = markType.uniqueName;
          stuff.properties.ableToSearch = markType.ableToSearch;

          if (stuff.properties.ableToSearch) {
            let p = [];
            p.push(stuff.properties.name);
            stuff.properties.description !=
              this.translate.instant('default-desription') &&
              p.push(stuff.properties.description);
            p.push(
              ...stuff.properties.stuff.items.map(
                (y: { uniqueName: string } ) => y.uniqueName
              )
            );

            stuff.feature = {
              properties: {
                search: p.join(', '),
              },
            };

            this.createProperty(
              stuff.feature.properties,
              'search',
              p,
              this.translate
            );

            let location = this.locations.locations.find(
              (y: { id: any }) => y.id == stuffModel.locationId
            );
            stuff.properties.locationUniqueName = location.uniqueName;
            stuff.properties.locationName = location.name;
          }

          stuff.bindTooltip((p: any) => this.createStuffTooltip(p), {
            sticky: true,
            className: 'map-tooltip',
            offset: new Point(0, 50),
          });
          stuff.bindPopup((p: any) => this.createStashPopup(p)).openPopup(),
            geoMarks.features.push(stuff);
        }

        this.addToCanvas(geoMarks, markType);
      }
    }
  }

  private addMarks() {
    let markTypes = [
      {
        id: 0,
        ableToSearch: !0,
        name: 'none',
      },
      {
        id: 1,
        ableToSearch: !0,
        name: this.translate.instant('sub-location'),
        uniqueName: 'sub-location',
        icon: L.icon({
          iconSizeInit: [4, 4],
          className: 'mark-container stalker-mark-4',
          animate: !1,
          iconUrl: '/assets/images/svg/marks/sub-location.svg',
          iconAnchor: [0, 0],
        }),
      },
      {
        id: 100,
        name: this.translate.instant('acidic'),
        uniqueName: 'acidic',
        icon: L.icon({
          iconSizeInit: [2, 2],
          className: 'mark-container stalker-mark-2',
          animate: !1,
          iconUrl: '/assets/images/svg/marks/chemical.svg',
          iconAnchor: [0, 0],
        }),
      },
      {
        id: 101,
        name: this.translate.instant('psychic'),
        uniqueName: 'psychic',
        icon: L.icon({
          iconSizeInit: [2, 2],
          className: 'mark-container stalker-mark-2',
          animate: !1,
          iconUrl: '/assets/images/svg/marks/psi.svg',
          iconAnchor: [0, 0],
        }),
      },
      {
        id: 102,
        name: this.translate.instant('radioactive'),
        uniqueName: 'radioactive',
        icon: L.icon({
          iconSizeInit: [2, 2],
          className: 'mark-container stalker-mark-2',
          animate: !1,
          iconUrl: '/assets/images/svg/marks/radiation.svg',
          iconAnchor: [0, 0],
        }),
      },
      {
        id: 103,
        name: this.translate.instant('thermal'),
        uniqueName: 'thermal',
        icon: L.icon({
          iconSizeInit: [2, 2],
          className: 'mark-container stalker-mark-2',
          animate: !1,
          iconUrl: '/assets/images/svg/marks/fire.svg',
          iconAnchor: [0, 0],
        }),
      },
      {
        id: 200,
        name: this.translate.instant('teleport'),
        uniqueName: 'teleport',
        icon: L.icon({
          iconSizeInit: [2, 2],
          className: 'mark-container stalker-mark-2',
          animate: !1,
          iconUrl: '/assets/images/svg/marks/portal.svg',
          iconAnchor: [0, 0],
        }),
      },
      {
        id: 201,
        name: this.translate.instant('mines'),
        uniqueName: 'mines',
        icon: L.icon({
          iconSizeInit: [1.5, 1.5],
          className: 'mark-container stalker-mark-1.5',
          animate: !1,
          iconUrl: '/assets/images/svg/marks/mines.svg',
          iconAnchor: [0, 0],
        }),
      },
    ];

    this.gamedata.marks = this.gamedata.marks.sort(
      (c: { typeId: number }, l: { typeId: number }) => c.typeId - l.typeId
    );
    for (let markType of markTypes) {
      let marks = this.gamedata.marks.filter(
        (u: { typeId: number }) => u.typeId == markType.id
      );

      if (marks.length > 0) {
        let geoMarks: any = {};
        geoMarks.type = 'FeatureCollection';
        geoMarks.features = [];

        for (let mark of marks) {
          let marker = L.marker([mark.y, mark.x], {
            icon: markType.icon,
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

            if (
              marker.properties.description !=
              this.translate.instant('default-desription')
            ) {
              p.push(marker.properties.description);
            }

            marker.feature = {
              properties: {
                search: p.join(', '),
              },
            };

            this.createProperty(
              marker.feature.properties,
              'search',
              p,
              this.translate
            );

            let location = this.locations.locations.find(
              (y: { id: any }) => y.id == mark.locationId
            );
            marker.properties.locationUniqueName = location.uniqueName;
            marker.properties.locationName = location.name;
          }

          marker.bindTooltip(
            (marker: any) => this.translate.instant(marker.properties.name),
            {
              sticky: true,
              className: 'map-tooltip',
              offset: [0, 50],
            }
          );
          geoMarks.features.push(marker);
        }

        this.addToCanvas(geoMarks, markType);
      }
    }
  }

  private createProperty(
    object: any,
    propertyName: string,
    array: string[],
    translate: TranslateService
  ): void {
    Object.defineProperty(object, propertyName, {
      get: function () {
        try {
          return this.array.map((x: string) => translate.instant(x)).join(', ');
        } catch (ex) {
          console.error(this.array);
          throw ex;
        }
      },
      set: function (array) {
        this.array = array;
      },
    });

    object[propertyName] = array;
  }

  private addStuffs_old() {
    let stuffTypes = [
      {
        id: 0,
        ableToSearch: !0,
        itemableToSearch: !0,
        name: this.translate.instant('stash'),
        uniqueName: 'stash',
        icon: L.icon({
          iconSizeInit: [1, 1],
          className: 'mark-container stalker-mark',
          animate: !1,
          iconUrl: '/assets/images/svg/marks/stash.svg',
          iconAnchor: [0, 0],
        }),
      },
      {
        id: 1,
        ableToSearch: !0,
        itemableToSearch: !0,
        name: this.translate.instant('quest'),
        uniqueName: 'quest',
        icon: L.icon({
          iconSizeInit: [1, 1],
          className: 'mark-container stalker-mark',
          animate: !1,
          iconUrl: '/assets/images/svg/marks/quest-item.svg',
          iconAnchor: [0, 0],
        }),
      },
      {
        id: 2,
        ableToSearch: !0,
        itemableToSearch: !0,
        name: this.translate.instant('destroyable-box'),
        uniqueName: 'destroyable-box',
        icon: L.icon({
          iconSizeInit: [1, 1],
          className: 'mark-container stalker-mark',
          animate: !1,
          iconUrl: '/assets/images/svg/marks/items.svg',
          iconAnchor: [0, 0],
        }),
      },
      {
        id: 3,
        ableToSearch: !0,
        itemableToSearch: !0,
        name: this.translate.instant('stuff'),
        uniqueName: 'stuff',
        icon: L.icon({
          iconSizeInit: [1, 1],
          className: 'mark-container stalker-mark',
          animate: !1,
          iconUrl: '/assets/images/svg/marks/stuff.svg',
          iconAnchor: [0, 0],
        }),
      },
    ];

    this.gamedata.stuffs = this.gamedata.stuffs.sort(
      (c: { typeId: number }, l: { typeId: number }) => c.typeId - l.typeId
    );
    for (let markType of stuffTypes) {
      let stuffsAtLocation = this.gamedata.stuffs.filter(
        (u: { typeId: number }) => u.typeId == markType.id
      );

      if (stuffsAtLocation.length > 0) {
        let geoMarks: any = {};
        geoMarks.type = 'FeatureCollection';
        geoMarks.features = [];

        for (let f of stuffsAtLocation) {
          let stuff = L.marker([f.y, f.x], {
            icon: markType.icon,
          });

          stuff.properties = {};
          stuff.properties.stuff = f;
          stuff.properties.name = f.name;
          stuff.properties.description = f.description;
          stuff.properties.items = f.items;
          stuff.properties.markType = markType.name;
          stuff.properties.typeUniqueName = markType.uniqueName;
          stuff.properties.ableToSearch = markType.ableToSearch;

          if (stuff.properties.ableToSearch) {
            let p = [];
            p.push(stuff.properties.name);
            stuff.properties.description !=
              this.translate.instant('default-desription') &&
              p.push(stuff.properties.description);
            p.push(
              ...stuff.properties.items.map(
                (y: { item: { uniqueName: string } }) => y.item.uniqueName
              )
            );

            stuff.feature = {
              properties: {
                search: p.join(', '),
              },
            };

            this.createProperty(
              stuff.feature.properties,
              'search',
              p,
              this.translate
            );

            let location = this.locations.locations.find(
              (y: { id: any }) => y.id == f.locationId
            );
            stuff.properties.locationUniqueName = location.uniqueName;
            stuff.properties.locationName = location.name;
          }

          stuff.bindTooltip((p: any) => this.createStuffTooltip_old(p), {
            sticky: true,
            className: 'map-tooltip',
            offset: new Point(0, 50),
          });
          stuff.bindPopup((p: any) => this.createStashPopup(p)).openPopup(),
            geoMarks.features.push(stuff);
        }

        this.addToCanvas(geoMarks, markType);
      }
    }
  }

  private createStuffTooltip(stuff: any) {
    let html = `<div class="header-tip"><p class="p-header">${this.translate.instant(
      stuff.properties.stuff.name
    )}</p></div>`;
    if (stuff.description) {
      html += `<div class="tooltip-text"><p>${this.translate.instant(
        stuff.properties.stuff.description
      )}</p></div>`;
    }

    return html;
  }

  private createStuffTooltip_old(stuff: {
    properties: { name: any; description: any };
    description: any;
  }) {
    let html = `<div class="header-tip"><p class="p-header">${this.translate.instant(
      stuff.properties.name
    )}</p></div>`;
    if (stuff.description) {
      html += `<div class="tooltip-text"><p>${this.translate.instant(
        stuff.properties.description
      )}</p></div>`;
    }

    return html;
  }

  private createStashPopup(stash: any) {
    stash.getPopup().on('remove', function () {
      stash.getPopup().off('remove');
      componentRef.destroy();
    });

    const factory = this.resolver.resolveComponentFactory(StuffComponent);

    const componentRef = this.container.createComponent(factory);
    componentRef.instance.stuff = stash.properties.stuff;
    componentRef.instance.game = this.game;
    componentRef.instance.allItems = this.items;
    componentRef.instance.stuffType = stash.properties.typeUniqueName;

    let lootBoxConfig = stash.properties.stuff.boxConfig ? this.lootBoxConfig.boxes.find(x => x.name == stash.properties.stuff.boxConfig) : null;
    let location = this.gamedata.locations.find((x: { id: any; }) => x.id == stash.properties.stuff.locationId);
    let lootBoxLocationConfig = this.lootBoxConfig.locations.find(x => x.name == location.uniqueName);

    componentRef.instance.lootBoxConfig = lootBoxConfig as LootBoxSection;
    componentRef.instance.lootBoxLocationConfig = lootBoxLocationConfig as LootBoxSection;


    return componentRef.location.nativeElement;
  }

  private addAnomalyZones() {
    let anomalyZoneIcon = {
      name: this.translate.instant('anomaly-zone'),
      uniqueName: 'anomaly-zone',
      cssClass: 'anomaly-zone',
      ableToSearch: true,
      icon: L.icon({
        iconSize: [4, 4],
        className: 'mark-container stalker-mark-2',
        animate: false,
        iconUrl: '/assets/images/svg/marks/anomaly.svg',
        iconSizeInit: [2, 2],
        iconAnchor: [0, 0],
      }),
    };
    let anomalyZoneNoArtIcon = {
      name: this.translate.instant('anomaly-zone-no-art'),
      uniqueName: 'anomaly-zone-no-art',
      icon: L.icon({
        iconSize: [12.5, 12.5],
        className: 'mark-container stalker-mark',
        animate: false,
        iconUrl: '/assets/images/svg/marks/anomaly_noart.svg',
        iconSizeInit: [1, 1],
        iconAnchor: [0, 0],
      }),
    };
    let anomalies: any = {};
    let anomaliesNoArt: any = {};
    anomalies.type = 'FeatureCollection';
    anomaliesNoArt.type = 'FeatureCollection';
    anomalies.features = [];
    anomaliesNoArt.features = [];

    for (let zone of this.gamedata.anomalyZones) {
      let canvasMarker;
      if (
        zone.anomaliySpawnSections != null &&
        zone.anomaliySpawnSections.length > 0
      ) {
        canvasMarker = L.marker([zone.y, zone.x], {
          icon: anomalyZoneIcon.icon,
        });
      } else {
        canvasMarker = L.marker([zone.y, zone.x], {
          icon: anomalyZoneNoArtIcon.icon,
        });
      }

      canvasMarker.properties = {};
      canvasMarker.properties.name = zone.name;
      canvasMarker.properties.description = zone.description;
      canvasMarker.properties.zoneModel = zone;

      if (
        zone.anomaliySpawnSections != null &&
        zone.anomaliySpawnSections.length > 0
      ) {
        canvasMarker.properties.anomaliySpawnSections =
          zone.anomaliySpawnSections;
        canvasMarker.properties.markType = anomalyZoneIcon.cssClass;
        canvasMarker.properties.ableToSearch = true;
        canvasMarker.properties.typeUniqueName = 'anomaly-zone';

        let searchFields = [];
        searchFields.push(canvasMarker.properties.name);

        if (
          canvasMarker.properties.description !=
          this.translate.instant('default-desription')
        ) {
          searchFields.push(canvasMarker.properties.description);
        }

        let artefactsSections = zone.anomaliySpawnSections.map(
          (item: { anomalySpawnItems: any[] }) =>
            item.anomalySpawnItems.map((ass) => ass.artefact.uniqueName)
        );

        for (let artefactsSection of artefactsSections) {
          for (let art of artefactsSection) {
            searchFields.push(art);
          }
        }

        canvasMarker.feature = {
          properties: { search: searchFields.join(', ') },
        };
        this.createProperty(
          canvasMarker.feature.properties,
          'search',
          searchFields,
          this.translate
        );

        anomalies.features.push(canvasMarker);

        let location = this.locations.locations.find(
          (x: { id: any }) => x.id == zone.locationId
        );
        if (location) {
          canvasMarker.properties.locationUniqueName = location.uniqueName;
          canvasMarker.properties.locationName = location.name;
        }
      } else {
        if (zone.anomalies != null) {
          canvasMarker.properties.anomalies = zone.anomalies;
        }
        anomaliesNoArt.features.push(canvasMarker);
        canvasMarker.properties.ableToSearch = false;
      }

      canvasMarker.bindTooltip(
        (zone: any) => {
          return this.createAnomalyZoneTooltip(zone);
        },
        { sticky: true, className: 'map-tooltip', offset: new Point(0, 50) }
      );
      canvasMarker
        .bindPopup((zone: any) => this.createeAnomalyZonePopup(zone), {
          maxWidth: 400,
        })
        .openPopup();
    }

    try {
      this.addToCanvas(anomalies, anomalyZoneIcon);

      if (anomaliesNoArt.features.length > 0) {
        this.addToCanvas(anomaliesNoArt, anomalyZoneNoArtIcon);
      }
    } catch (e) {
      console.log(e);
    }
  }

  private addTraders() {
    let traderIcon = {
      name: this.translate.instant('traders'),
      uniqueName: 'traders',
      cssClass: 'tradere',
      ableToSearch: true,
      icon: L.icon({
        iconSize: [4, 4],
        className: 'mark-container stalker-mark-2',
        animate: false,
        iconUrl: '/assets/images/svg/marks/trader.svg',
        iconSizeInit: [2, 2],
        iconAnchor: [0, 0],
      }),
    };

    let traders: any = {};
    traders.type = 'FeatureCollection';
    traders.features = [];

    for (let trader of this.gamedata.traders) {
      let canvasMarker = L.marker([trader.y, trader.x], {
        icon: traderIcon.icon,
      });

      canvasMarker.properties = {};
      canvasMarker.properties.traderConfig = trader;
      canvasMarker.properties.name = trader.name + '.name';
      canvasMarker.properties.typeUniqueName = traderIcon.uniqueName;
      traders.features.push(canvasMarker);
      canvasMarker.properties.ableToSearch = false;
      canvasMarker.feature = {};
      canvasMarker.feature.properties = {};
      this.createProperty(
        canvasMarker.feature.properties,
        'search',
        [trader.name + '.name'],
        this.translate
      );

      let location = this.locations.locations.find(
        (y: { id: any }) => y.id == trader.locationId
      );
      canvasMarker.properties.locationUniqueName = location.uniqueName;

      canvasMarker.bindTooltip(
        (marker: any) =>
          this.translate.instant(marker.properties.traderConfig.name + '.name'),
        {
          sticky: true,
          className: 'map-tooltip',
          offset: [0, 50],
        }
      );

      canvasMarker
        .bindPopup(
          (trader: any) =>
            this.createTraderPopup(trader, this.gamedata.traders, canvasMarker),
          { maxWidth: 1400 }
        )
        .openPopup();
    }

    this.addToCanvas(traders, traderIcon);
  }

  private addToCanvas(geoMarks: any, markType: any) {
    let marksLayer = L.geoJSON(geoMarks);
    marksLayer.ableToSearch = markType.ableToSearch ?? false;
    marksLayer.isShowing = false;
    marksLayer.markers = geoMarks.features;
    marksLayer.name = markType.uniqueName;
    this.layers[markType.name] = marksLayer;

    marksLayer.hide = (layer: { isShowing: boolean; markers: any }) => {
      if (layer.isShowing) {
        this.canvasLayer.removeMarkers(layer.markers);

        layer.isShowing = false;
      }
    };

    marksLayer.show = (layer: { isShowing: boolean; markers: any }) => {
      if (!layer.isShowing) {
        this.canvasLayer.addMarkers(layer.markers);

        layer.isShowing = true;
      }
    };

    marksLayer.show(marksLayer);
  }

  private createAnomalyZoneTooltip(zone: {
    properties: { name: any; description: any };
    description: any;
  }) {
    let html = `<div class="header-tip"><p class="p-header">${
      zone.properties.name != null
        ? this.translate.instant(zone.properties.name)
        : this.translate.instant('anomaliesCluster')
    }</p></div>`;
    if (zone.description) {
      html += `<div class="tooltip-text"><p>${zone.properties.description}</p></div>`;
    }

    return html;
  }

  private createeAnomalyZonePopup(zone: any) {
    /*let descHtml = `<div><div class='popup header'>${this.translate.instant('anomaliesCluster')}</div>${ zone.properties.description != null ? `<div class='popup description'>${zone.properties.description}</div>` : ''}</div>`

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
                  let anomalyNameSection = '';

                  if (section.anomalyUniqueName != null) {
                    if (section.count > 1) {
                      anomalyNameSection = `<div>${section.count} x ${this.translate.instant(section.anomalyUniqueName)}</div>`;
                    }
                    else {
                      anomalyNameSection = `<div>${this.translate.instant(section.anomalyUniqueName)}</div>`;
                    }
                  }
                  else {
                    anomalyNameSection = anomalyCountSection;
                  }

                  sectionsHtml += `<div class='section'><div class='anomaly-section-info'>${anomalyNameSection}<div>${this.translate.instant('anomalyArtMaxCount', {count: section.maxCapacity})}</div></div>`;
                  sectionsHtml += `<div class="inventory">`;
                  let items = section.anomalySpawnItems.sort(function (a: { probability: number; }, b: { probability: number; }) {
                      return -(a.probability - b.probability);
                  });

                  for (let item of items) {
                      sectionsHtml += `<div class="inventory-item inventory-item-width-1 inventory-item-height-1">`
                      sectionsHtml += `<div class="inventory-item-percentage">${Math.floor(item.probability * 100)}%</div>`;
                      sectionsHtml += `<div class="inventory-item-image ${item.artefact.uniqueName} ${this.gamedata.uniqueName}" title="${item.artefact.name}"></div></div>`;
                  }

                  sectionsHtml += '</div></div>';
                  maxArtefactsInZone += section.count * section.maxCapacity;
              }
          }

          sectionsHtml += `</div><div class='anomaly-section-info'>${this.translate.instant('anomalyZoneArtMaxCount', {count: maxArtefactsInZone})}</div>`

          descHtml += sectionsHtml;
          descHtml += `<div class="bottom"><div link-uniqueName="${zone.properties.typeUniqueName}" link-lng="${zone._latlng.lng}" link-lat="${zone._latlng.lat}" link-game="${this.gamedata.name}" class="button url-button" onclick="copyLink(this)"><span>Mark link</span></div></div>`;
      }

      if (zone.properties.anomalies != null && zone.properties.anomalies.length > 0) {
        descHtml += `<div class='anomalies-in-claster-container'>`;
        for (let anomaly of zone.properties.anomalies) {
          descHtml += `<div class='anomaly-in-claster'> ${anomaly.count} x ${this.translate.instant(anomaly.uniqueName)}</div>`
        }

        descHtml += '</div>'
      }*/

    const analytics = getAnalytics();
    logEvent(analytics, 'open-anomaly-zone-popup', {
      type: zone.properties.typeUniqueName,
      location: zone.properties.locationUniqueName,
      coordinates: `${zone._latlng.lat} ${zone._latlng.lng}`,
      game: this.game,
      language: this.translate.currentLang,
    });

    //return descHtml;

    zone.getPopup().on('remove', function () {
      zone.getPopup().off('remove');
      componentRef.destroy();
    });

    const factory = this.resolver.resolveComponentFactory(AnomalyZoneComponent);

    const componentRef = this.container.createComponent(factory);
    componentRef.instance.anomalZone = zone.properties.zoneModel;
    componentRef.instance.game = this.game;
    return componentRef.location.nativeElement;
  }

  private createTraderPopup(traderMarker: any, traders: any[], marker: any) {
    let trader: TraderModel = traderMarker.properties.traderConfig;

    marker.getPopup().on('remove', function () {
      marker.getPopup().off('remove');
      componentRef.destroy();
    });

    const factory = this.resolver.resolveComponentFactory(TraderComponent);

    const componentRef = this.container.createComponent(factory);
    componentRef.instance.trader = trader;
    componentRef.instance.allTraders = traders as TraderModel[];
    componentRef.instance.game = {
      gameName: this.game,
      id: this.avaliableGames.indexOf(this.game) + 1,
    };
    return componentRef.location.nativeElement;
  }

  private async addScript(scriptUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = scriptUrl;
      document.body.appendChild(script);
      script.onload = () => {
        console.log(`${scriptUrl} is loaded.`);
        resolve();
      };
    });
  }

  private async addStyle(styleUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = styleUrl;
      document.body.appendChild(style);
      style.onload = () => {
        console.log(`${styleUrl} is loaded.`);
        resolve();
      };
    });
  }
}
