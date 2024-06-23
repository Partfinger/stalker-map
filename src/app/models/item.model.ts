export class Item {
    public uniqueName: string;
    public localeName: string;
    public width: number;
    public height: number;
    public area: number;

    public gridX: number;
    public gridY: number;

    public isQuest: boolean;
    public installedUpgrades: string[];

    public hasScope: boolean;
    public hasSilencer: boolean;
    public hasGrenadeLauncher: boolean;

    public scopeX: number;
    public scopeY: number;
    public silencerX: number;
    public silencerY: number;
    public grenadeLauncherX: number;
    public grenadeLauncherY: number;

    public price: number;
    public boxSize: number;
}
