export class Item {
    public uniqueName: string;
    public localeName: string;
    public description: string;
    public width: number;
    public height: number;
    public weight: number;
    public area: number;
    public category: string;

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

    public upgr_icon_x : number;
    public upgr_icon_y : number;
    public upgr_icon_width : number;
    public upgr_icon_height : number;

    public $type: string;

    public camRelaxSpeed : number;
    public camDispersion : number;
    public camDispersionInc : number;
    public camDispertionFrac : number;
    public camMaxAngle : number;
    public camMaxAngleHorz : number;
    public camStepAngleHorz : number;

    public fireDistance : number;
    public bulletSpeed : number;
    public rpm : number;
    public ammoMagazineSize : number;
    public conditionShotDec : number;

    public fireDispersionBase : number;
    public fireDispersionConditionFactor : number;

    public misfireProbability : number;
    public misfireConditionK : number;
}
