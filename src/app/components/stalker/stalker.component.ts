import { Component, Input } from '@angular/core';
import { Stalker } from '../../models/stalker.model';
import { Item } from '../../models/item.model';
import { StuffItem } from '../../models/stuff';
import { TranslateModule } from '@ngx-translate/core';
import { NgFor, NgIf } from '@angular/common';
import { StalkerProfileComponent } from "../stalker-profile/stalker-profile.component";
import { RankSetting } from '../../models/rank-settings.model';

@Component({
    selector: 'app-stalker',
    standalone: true,
    templateUrl: './stalker.component.html',
    styleUrl: './stalker.component.scss',
    imports: [TranslateModule, NgFor, NgIf, StalkerProfileComponent]
})
export class StalkerComponent {
  @Input() public stalker: Stalker;
  @Input() public game: string;
  @Input() public allItems: Item[];
  @Input() public rankSetting: RankSetting[];

  public inventory: StuffItem[];

  private async ngOnInit(): Promise<void> {
    console.log(this.stalker);

    if (this.stalker.inventoryItems?.length > 0) {
      this.inventory = [];

      for (let inv of this.stalker.inventoryItems) {
        let item = new StuffItem();
        item.item = this.allItems.find(y => y.uniqueName == inv.uniqueName) as Item;
        item.count = inv.count;
        this.inventory.push(item);
      }

      this.inventory.sort((x, y) => {
        let dw = x.item.width - y.item.width;

        if (dw != 0) {
          return -dw;
        }

        return y.item.area - x.item.area;
      })

      console.log(this.inventory);
    }
  }
}
