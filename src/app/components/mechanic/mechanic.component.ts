import { MapService } from './../../services/map.service';
import { Component, Input } from '@angular/core';
import { Mechanic, MechanicDiscount } from '../../models/mechanic.model';
import { Item } from '../../models/item.model';
import { RankSetting } from '../../models/rank-settings.model';
import { RelationType } from '../../models/gamedata/map-config';
import { CharacterProfile } from '../../models/character-profile.model';
import { TranslateModule } from '@ngx-translate/core';
import { StalkerProfileComponent } from "../stalker-profile/stalker-profile.component";
import { NgClass, NgFor, NgIf, NgStyle } from '@angular/common';
import { ItemUpgrade, Upgrade, UpgradeProperty, UpgradeSection } from '../../models/upgrades/upgrades';
import { TooltipDirective } from '../tooltips/tooltip.directive';
import { UpgradeTooltipComponent } from '../tooltips/upgrade-tooltip/upgrade-tooltip.component';
import { ItemTooltipComponent } from '../tooltips/item-tooltip/item-tooltip.component';
import Chart, { BubbleDataPoint } from 'chart.js/auto';

@Component({
  selector: 'app-mechanic',
  standalone: true,
  imports: [TranslateModule, StalkerProfileComponent, NgFor, NgIf, NgStyle, NgClass, TooltipDirective],
  templateUrl: './mechanic.component.html',
  styleUrl: './mechanic.component.scss'
})
export class MechanicComponent {
  @Input() public mechanic: Mechanic;
  @Input() public game: string;
  @Input() public allItems: Item[];
  @Input() public rankSetting: RankSetting[];
  @Input() public relationType: RelationType;
  @Input() public actor: CharacterProfile;
  @Input() public upgrades: ItemUpgrade[];
  @Input() public upgradeProperties: UpgradeProperty[];

  public readonly relations: number[] = [0, 0.5, 1];
  public readonly relationsTitle: string[] = ['enemy', 'neutral', 'friend'];
  public selectedRelationId: number = 1;
  public relation: number = this.relations[1];
  public selectedDiscount: MechanicDiscount;
  public discounts: MechanicDiscount[];
  public selectedItem: Item;
  public selectedItemForUpgrades: Item;
  public selectedItemUpgrade: ItemUpgrade;

  public relationTypeEnum = RelationType;
  public itemsToRepait: Item[];
  public Math: Math = Math;
  public upgradeTooltipComponent: any = UpgradeTooltipComponent;
  public itemTooltipComponent: any = ItemTooltipComponent;

  public repairPriceFactor: number = 0.6;
  public recoilTimeChart: any;
  public weaponDynamicChart: any;

  constructor(private mapService: MapService) { }

  private async ngOnInit(): Promise<void> {
    if (this.mechanic.itemsForUpgrader?.length > 0) {
      this.itemsToRepait = [];

      for (let inv of this.mechanic.itemsForUpgrader) {
        let item = this.allItems.find(y => y.uniqueName == inv) as Item;

        if (item) {
          this.itemsToRepait.push(item);
        }
      }

      this.itemsToRepait.sort((x, y) => {
        let dw = x.width - y.width;

        if (dw != 0) {
          return -dw;
        }

        return y.area - x.area;
      })
    }

    this.selectedDiscount = new MechanicDiscount();
    this.selectedDiscount.condition = '';
    this.selectedDiscount.value = 1;

    if (this.mechanic.discounts?.length > 0) {
      this.discounts = [];

      for (let discount of this.mechanic.discounts) {
        let discountNew = JSON.parse(JSON.stringify(discount));
        discountNew.conditions = discount.condition.split(' ').map(x => x.replace('+', '').replace('=', ''));
        this.discounts.push(discountNew);
      }

      if (this.discounts.length > 0) {
        this.discounts.push(this.selectedDiscount);
        this.discounts.reverse();
      }
    }
  }

  public selectDiscount(discount: MechanicDiscount): void {
    this.selectedDiscount = discount;
  }

  public selectItem(item: Item): void {
      this.selectedItem = item;
      this.selectedItemForUpgrades = JSON.parse(JSON.stringify(this.selectedItem));
      let selectedItemUpgrade = this.upgrades.find(x => x.item == item.uniqueName) as ItemUpgrade;
      let lockedUpgrades = this.mechanic.upgradeConditions.filter(x => x.condition == 'false');

      if (this.recoilTimeChart) {
        this.recoilTimeChart.destroy();
      }

      if (this.weaponDynamicChart) {
        this.weaponDynamicChart.destroy();
      }

      for (let up of lockedUpgrades) {
        up.upgrade = up.upgrade.replace('_sect_', '_');
      }

      if (selectedItemUpgrade) {
        this.selectedItemUpgrade = JSON.parse(JSON.stringify(selectedItemUpgrade));

        if (this.selectedItemForUpgrades.installedUpgrades && this.selectedItemForUpgrades.installedUpgrades.length > 0) {
          for (let section of this.selectedItemUpgrade.upgradeSections) {
            let isBlocked = false;
            for (let upgrade of section.elements) {
              upgrade.isBlocked = isBlocked;
              upgrade.isInstalled = this.selectedItemForUpgrades.installedUpgrades.includes(upgrade.name);
              if (upgrade.isInstalled) {
                isBlocked = true;
              }
            }

            if (isBlocked) {
              section.elements.filter(x => !x.isInstalled).forEach(x => x.isBlocked = true);
            }
          }
        }

        let branchId: number = 0;

        for (let section of this.selectedItemUpgrade.upgradeSections) {
          if (section.branch == null || section.branch < 0) {
            section.branch = branchId++;

            if (section.elements) {
              let branchElements: Upgrade[] = [];

              for (let element of section.elements) {
                branchElements.push(element);
                if (lockedUpgrades.some(x => x.upgrade == element.name)) {
                  element.isLocked = true;
                }
              }

              for (let element of branchElements) {
                if (element.effects) {
                  for (let effect of element.effects) {
                    let anotherSection = this.selectedItemUpgrade.upgradeSections.find(x => x.name == effect);

                    if (anotherSection) {
                      anotherSection.branch = section.branch;

                      if (anotherSection.elements) {
                        for (let aElement of anotherSection.elements) {
                          branchElements.push(aElement);

                          if (lockedUpgrades.some(x => x.upgrade == aElement.name)) {
                            aElement.isLocked = true;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      else {
        this.selectedItemUpgrade = undefined as unknown as ItemUpgrade;
      }

      if (item.$type == "weapon") {
        this.resetWeaponStats();
      }
  }

  public selectUpgrade(upgrade: Upgrade, upgradeSection: UpgradeSection): void {
    if (upgrade.isLocked) {
      return;
    }

    console.log(upgrade)
    let effectsProps: string[] = []
    let effectsValues: any[] = [];

    if (upgrade.propertiesEffects) {
      effectsProps = Object.keys(upgrade.propertiesEffects);
      effectsValues = Object.values(upgrade.propertiesEffects);
    }

    let itemProps = Object.keys(this.selectedItemForUpgrades);

    if (upgrade.isInstalled) {
      for (let up of upgradeSection.elements) {
        up.isBlocked = false;

        if (up.isInstalled && up.propertiesEffects) {
          let effectsPropsUp = Object.keys(up.propertiesEffects);
          let effectsValuesUp = Object.values(up.propertiesEffects);

          for (let i = 0; i < effectsPropsUp.length; i++) {
            this.applyUpgradeEffect(effectsPropsUp[i], effectsValuesUp[i], -1);
          }
        }

        up.isInstalled = false;
      }

      /*for (let i = 0; i < effectsProps.length; i++) {
        this.applyUpgradeEffect(effectsProps[i], effectsValues[i], -1);
      }*/
    }
    else {
      for (let up of upgradeSection.elements) {
        up.isBlocked = true;

        if (up.isInstalled && up.propertiesEffects) {
          let effectsPropsUp = Object.keys(up.propertiesEffects);
          let effectsValuesUp = Object.values(up.propertiesEffects);

          for (let i = 0; i < effectsPropsUp.length; i++) {
            this.applyUpgradeEffect(effectsPropsUp[i], effectsValuesUp[i], -1);
          }
        }

        up.isInstalled = false;
      }

      upgrade.isBlocked = false;
      upgrade.isInstalled = true;

      for (let i = 0; i < effectsProps.length; i++) {
        this.applyUpgradeEffect(effectsProps[i], effectsValues[i], 1);
      }
    }

    if (this.selectedItem.$type == "weapon") {
      this.resetWeaponStats();
    }
  }

  private applyUpgradeEffect(propName: string, effectsValues: string, koeff: number): void {
    let propNameParts = propName.split('_');

    if (propNameParts.length > 1) {

      for (let i = 1; i < propNameParts.length; i++) {
        propNameParts[i] = propNameParts[i].charAt(0).toUpperCase() + propNameParts[i].slice(1);
      }

      propName = propNameParts.join('')
    }

    let value = parseFloat(effectsValues);

    switch (propName) {
      case "ammoMagSize": {
        this.selectedItemForUpgrades.ammoMagazineSize += koeff * value;
        break;
      }
      case "invWeight": {
        this.selectedItemForUpgrades.weight += koeff * value;
        break;
      }
      default: {
        (this.selectedItemForUpgrades as any)[propName] += koeff * value;
      }
    }
  }

  public selectedItemHasUpgrade(upgrade: string): boolean {
    return this.selectedItem.installedUpgrades?.includes(upgrade);
  }

  public setRelationSelect(relation: string): void {
    this.selectedRelationId = parseInt(relation);
    this.relation = this.relations[this.selectedRelationId];
    //this.recalculateSection();
  }

  public setRelationSelectRange(relation: string): void {
    this.relation = parseFloat(relation);
    //this.recalculateSection();
  }

  private resetWeaponStats(): void {
    let maxTime = (60 / this.selectedItem.rpm) * this.selectedItem.ammoMagazineSize;
    let shots: BubbleDataPoint[] = [];
    let shotsUp: BubbleDataPoint[] = [];

    let deltaTime = (60 / this.selectedItem.rpm);
    let deltaTimeUp = (60 / this.selectedItemForUpgrades.rpm);

    let currentTime = 0;
    let currentTimeUp = 0;

    let currentAngle = 0;
    let currentAngleUp = 0;

    for (let shot = 0; shot < this.selectedItem.ammoMagazineSize; shot++) {
      shots.push({x: currentTime, y: currentAngle, r: 1});
      //cam_dispersion*cam_dispersion_frac +- cam_dispersion*(1-cam_dispersion_frac)
      currentTime += deltaTime;
      let angle = (this.selectedItem.camDispersion + this.selectedItem.camDispersionInc * (shot + 1)) * this.selectedItem.camDispertionFrac;
      currentAngle += angle;

      /*if (shot > 1) {
        currentAngle -= this.selectedItem.camRelaxSpeed * deltaTime
      }*/

      if (currentAngle > this.selectedItem.camMaxAngle) {
        currentAngle = this.selectedItem.camMaxAngle;
      }
    }

    for (let shot = 0; shot < this.selectedItemForUpgrades.ammoMagazineSize; shot++) {
      shotsUp.push({x: currentTimeUp, y: currentAngleUp, r: 1});
      //cam_dispersion*cam_dispersion_frac +- cam_dispersion*(1-cam_dispersion_frac)
      currentTimeUp += deltaTimeUp;
      let angle = (this.selectedItemForUpgrades.camDispersion + this.selectedItemForUpgrades.camDispersionInc * (shot + 1)) * this.selectedItemForUpgrades.camDispertionFrac;
      currentAngleUp += angle;

      if (currentAngleUp > this.selectedItemForUpgrades.camMaxAngle) {
        currentAngleUp = this.selectedItemForUpgrades.camMaxAngle;
      }
    }

    let n = 20;

    let maxDist = Math.max(this.selectedItemForUpgrades.fireDistance, this.selectedItem.fireDistance);

    let dx = maxDist / n;

    let dynamic: BubbleDataPoint[] = [];
    let dynamicUp: BubbleDataPoint[] = [];

    for (let i = 0; i < n + 1; i++) {
      let x = dx * i;

      let time = x / this.selectedItem.bulletSpeed;
      let d = this.bulletDinamic(this.selectedItem.bulletSpeed, 0, 0, time)
      dynamic.push({x: d[0], y: d[1]});

      let timeUp = x / this.selectedItemForUpgrades.bulletSpeed;
      let dUp = this.bulletDinamic(this.selectedItemForUpgrades.bulletSpeed, 0, 0, timeUp)
      dynamicUp.push({x: dUp[0], y: dUp[1]});
    }

    if (this.recoilTimeChart) {
      this.recoilTimeChart.destroy();
    }

    this.recoilTimeChart = new Chart("dispersion-chart-canvas", {
      type: 'line',
      data: {
        datasets: [
          {
            data: shotsUp,
            label: 'Модифікована',
            backgroundColor: 'green',
            borderColor: 'green',
          },
          {
            data: shots,
            label: 'Базова',
            backgroundColor: 'white',
            borderColor: 'white',
            pointRadius: 5
          },
      ]
      },
      options: {
        scales: {
          x: {
            type: 'linear'
          }
        },
        parsing: false
      }
    });

    if (this.weaponDynamicChart) {
      this.weaponDynamicChart.destroy();
    }

    this.weaponDynamicChart = new Chart("dynamic-chart-canvas", {
      type: 'line',
      data: {
        datasets: [
          {
            data: dynamicUp,
            label: 'Модифікована',
            backgroundColor: 'green',
            borderColor: 'green',
          },
          {
            data: dynamic,
            label: 'Базова',
            backgroundColor: 'white',
            borderColor: 'white',
            pointRadius: 5
          },
      ]
      },
      options: {
        scales: {
          x: {
            type: 'linear'
          }
        },
        parsing: false
      }
    });

    /*this.weaponDynamicChart = new Chart("dynamic-chart-canvas", {
      type: 'line',

      data: {
        datasets: [{
          data: dynamic,

          backgroundColor: 'white',
          borderColor: 'white',
          borderWidth: 2,
          label: 'Базова',
          hoverBackgroundColor: 'rgba(255, 99, 132, 0.8)',
          hoverBorderColor: 'rgba(255, 99, 132, 1)',
          hoverBorderWidth: 3,
        },
        {
          data: dynamicUp,

          backgroundColor: 'green',
          borderColor: 'green',
          borderWidth: 2,
          label: 'Модифікована',
          hoverBackgroundColor: 'green',
          hoverBorderColor: 'white',
          hoverBorderWidth: 3,
        },
      ]
      },
      options: {
        scales: {
          x: {
            beginAtZero: true
          }
        }
      }
    });*/
  }

  private bulletDinamic(v0: number, h0: number, a0: number, t: number):any {
    return [
      v0 * t * Math.cos(a0),
      h0 + v0 * t * Math.sin(a0) - (9.81 * t * t) / 2,
    ]
  }
}
