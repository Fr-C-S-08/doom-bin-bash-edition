import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../dimensions';
import { DoorSystem } from '../systems/DoorSystem';
import { GameDirector, type SpawnRequest } from '../systems/GameDirector';
import {
  buildEncounterPatternSpawns,
  getEncounterPatternKinds,
  type EncounterPatternId
} from '../systems/EncounterPattern';
import { KeySystem } from '../systems/KeySystem';
import { TriggerSystem } from '../systems/TriggerSystem';
import { getEnemyConfig } from '../entities/enemyConfig';
import type { EnemyKind } from '../types/game';
import {
  AudioFeedbackSystem,
  getDynamicAmbientAudioPlan,
  getDirectorEventAudioPlan,
  getWeaponAudioPlan
} from '../systems/AudioFeedbackSystem';
import type { DirectorEvent } from '../systems/DirectorEvents';
import { DIRECTOR_STATE_LABELS, type DirectorDebugInfo, type DirectorState } from '../systems/DirectorState';
import {
  applyWeaponFireFeel,
  applyWeaponSwitchFeel,
  buildWeaponViewFeel,
  createCombatFeelRuntimeState,
  getCombatImpactAudioOptions,
  getDeathFeedbackProfile,
  getHitMarkerFeedbackTiming,
  getMuzzleFlashDecayMs,
  getWeaponFireAudioPitch,
  shouldSkipGameplayDuringFreeze,
  tickCombatFeelRuntime,
  type CombatFeelRuntimeState
} from '../raycast/RaycastCombatFeel';
import { getRaycastCrosshairTargetInfo, RaycastCombatSystem } from '../raycast/RaycastCombatSystem';
import {
  cloneRaycastEnemies,
  createRaycastEnemy,
  createTelegraphedRaycastEnemy,
  didRaycastEnemyFinishTelegraph,
  type RaycastEnemy
} from '../raycast/RaycastEnemy';
import {
  updateRaycastEnemies,
  notifyRaycastGunfire,
  updateRaycastEnemyProjectiles,
  type RaycastEnemyProjectile
} from '../raycast/RaycastEnemySystem';
import {
  cloneRaycastMap,
  findRaycastZoneId,
  getRaycastExitAccess,
  getRaycastLevelById,
  RAYCAST_WORLD_TWO_CATALOG,
  RAYCAST_WORLD_THREE_CATALOG,
  RAYCAST_LEVEL_BOSS,
  isRaycastPointReachable,
  getSafeDirectorSpawnPoints,
  isNearPoint,
  openRaycastDoor,
  registerRaycastPickup,
  registerRaycastSecret,
  RAYCAST_LEVEL,
  isRaycastSpawnPlacementValid,
  type RaycastDoor,
  type RaycastEncounterBeat,
  type RaycastEncounterPatternBinding,
  type RaycastLevel,
  isRaycastMapPointReachable
} from '../raycast/RaycastLevel';
import {
  buildSyntheticBossLateralBinding,
  selectRaycastEncounterPatternBinding
} from '../raycast/RaycastEncounterDirector';
import { getRaycastEpisodeState, resolveRaycastNextLevelId } from '../raycast/RaycastEpisode';
import {
  buildRaycastMinimapModel,
  buildStaticRaycastMinimapCells,
  getRaycastMinimapEnemyDotStyle,
  type RaycastMinimapCell,
  type RaycastMinimapEnemyBlip,
  type RaycastMinimapMarker
} from '../raycast/RaycastMinimap';
import { registerRaycastOptionalAssets } from '../raycast/raycastAssetHooks';
import {
  addRaycastBossClearScore,
  addRaycastCampaignCompletionBonus,
  addRaycastKillScore,
  addRaycastSecretScore,
  addRaycastSectorPerformanceBonus,
  computeRaycastCampaignMedals,
  computeRaycastSectorMedals,
  createEmptyCampaignMetrics,
  mergeCampaignMetrics,
  RAYCAST_FULL_ARC_CLEAR_BONUS,
  RAYCAST_WORLD2_ENTRY_POINTS,
  RAYCAST_WORLD3_ENTRY_POINTS,
  readRaycastHighScore,
  writeRaycastHighScoreIfBetter,
  type RaycastCampaignMetrics,
  type RaycastSectorMetrics
} from '../raycast/RaycastScore';
import {
  computeRaycastBossWeaponDamage,
  countRaycastBossConnectingPellets,
  createRaycastBossState,
  damageRaycastBoss,
  getRaycastBossPhaseLabel,
  getRaycastBossCrosshairTarget,
  tickRaycastBossArenaTwist,
  tickRaycastBossMovement,
  tickRaycastBossVolleys,
  type RaycastBossState
} from '../raycast/RaycastBoss';
import {
  BOSS_INTRO_DURATION_MS,
  getBossIntroCopy,
  getDesperationPhaseLabel,
  isBossDesperation,
  tickDualBossCoordination
} from '../raycast/RaycastBossAI';
import {
  adjustDirectorSpawnKind,
  countAliveByKind,
  formatRaycastEnemyIdentityLabel,
  getRaycastEliteKillScoreBonus,
  getRaycastEnemyIdentity,
  getRaycastSpawnTelegraphMs,
  rollRaycastEnemyVariant
} from '../raycast/RaycastEnemyIdentity';
import {
  createRaycastBossHazardState,
  getRaycastBossHazardMarkers,
  tickRaycastBossHazards,
  type RaycastBossHazardMarker,
  type RaycastBossHazardState
} from '../raycast/RaycastBossHazards';
import { castRay, RAYCAST_PLAYER_START, type RaycastMap } from '../raycast/RaycastMap';
import { getRaycastHudCss, RAYCAST_PALETTE, type RaycastHudCssBundle } from '../raycast/RaycastPalette';
import {
  buildRaycastCurrentObjective,
  buildRaycastHintText,
  formatRaycastObjectiveHudLabel,
  type RaycastBlockedReason,
  type RaycastObjectiveState
} from '../raycast/RaycastObjective';
import {
  applyWorldSegmentToAtmosphere,
  getAtmosphereForDirector,
  getRaycastBossHudLines,
  getRaycastCombatMessageForSegment,
  getRaycastExitMessageForSegment,
  getRaycastIntroMessageForSegment,
  RAYCAST_ATMOSPHERE,
  type RaycastWorldSegmentId
} from '../raycast/RaycastAtmosphere';
import {
  applyRaycastEventScoreMultiplier,
  createSeededLevelEventRng,
  selectRaycastLevelEvent,
  type RaycastLevelEventDefinition
} from '../raycast/RaycastLevelEventDirector';
import {
  applyRunModifierRankBonus,
  applyRunModifierScore,
  getRunModifierById,
  type RunModifier,
  type RunModifierId
} from '../raycast/RunModifierRoulette';
import {
  applyRaycastVariantToBaseHealth,
  getRaycastFlashDurationMs,
  getRaycastVariantModifiers,
} from '../raycast/RaycastEnemyVariants';
import type { RaycastSetpieceCue } from '../raycast/RaycastSetpiece';
import {
  buildRaycastPickupToastLayout,
  createRaycastPickupToastQueue,
  getRaycastPickupToastDisplay,
  mapRaycastHealthPickupToastKind,
  pruneRaycastPickupToastQueue,
  pushRaycastPickupToast,
  RAYCAST_PICKUP_TOAST_FADE_MS,
  type RaycastPickupToastKind,
  type RaycastPickupToastQueueState
} from '../raycast/RaycastPickupToast';
import {
  buildRaycastHudLayout,
  buildRaycastDebugLine,
  buildRaycastFocusedEnemyLine,
  buildRaycastHudProgressLine,
  buildRaycastHudStatusLine,
  buildRaycastMinimapLegendLine,
  buildRaycastScoreHudLine,
  getRaycastHealthVisualState,
  shouldSuppressRaycastCenterHudBanner
} from '../raycast/RaycastHud';
import {
  createRaycastDifficultyDirectorConfig,
  DEFAULT_RAYCAST_DIFFICULTY_ID,
  getRaycastDifficultyHealthPickup,
  getRaycastDifficultyPassiveHealConfig,
  getRaycastDifficultyPreset,
  RAYCAST_DIFFICULTY_REGISTRY_KEY,
  scaleRaycastIncomingDamage,
  type RaycastDifficultyId
} from '../raycast/RaycastDifficulty';
import {
  buildRaycastDeathOverlayHint,
  buildRaycastDeathOverlaySummary,
  buildRaycastEpisodeBanner,
  buildRaycastHelpOverlayText,
  buildRaycastLevelStartObjectiveMessage,
  buildRaycastMasteryEndingLines,
  buildRaycastOverlayHint,
  buildRaycastPriorityMessage,
  buildRaycastStatusMessage
} from '../raycast/RaycastPresentation';
import {
  applyRaycastMasteryUnlock,
  evaluateRaycastMasteryEnding,
  readRaycastMasteryUnlockState,
  writeRaycastMasteryUnlockState,
  type RaycastMasteryUnlockState
} from '../raycast/RaycastMasteryEnding';
import { buildRaycastRunSummary, computeRaycastRunMasteryRankParts } from '../raycast/RaycastRunSummary';
import { RaycastPlayerController, type RaycastPlayerState } from '../raycast/RaycastPlayerController';
import { RAYCAST_MOVEMENT } from '../raycast/RaycastMovement';
import { RaycastRenderer, type RaycastBillboard } from '../raycast/RaycastRenderer';
import {
  createRaycastFrameStatsState,
  formatRaycastDebugHudExtras,
  formatRaycastPerfHudLine,
  recordRaycastFrameSample,
  type RaycastFrameStatsState
} from '../raycast/RaycastFrameStats';
import { buildRaycastGameMasterSnapshot } from '../raycast/RaycastGameMasterSnapshot';
import { buildRaycastNarrationLayoutFromHud } from '../raycast/RaycastNarration';
import { RaycastNarrationOverlay } from '../raycast/RaycastNarrationOverlay';
import {
  createRaycastAdaptiveQualityState,
  getEffectiveMinimapStride,
  updateAdaptiveMinimapStrideBoost,
} from '../raycast/RaycastAdaptiveQuality';
import { appendRaycastPlaytestTelemetry } from '../raycast/RaycastTelemetry';
import { GameMasterNarrationBridge } from '../../services/gameMasterNarrationBridge';
import type {
  GameMasterNarrationEventId,
  GameMasterNarrationTier,
} from '../../services/gameMasterNarrationTypes';
import { PLAYER_DEATH_GM_MESSAGE } from '../../services/gameMasterNarrationTypes';
import type { GameMasterSource } from '../../services/gameMasterClient';
import {
  buildGameMasterObjectiveReminderMessage,
  GM_OBJECTIVE_REMINDER_COOLDOWN_MS,
} from '../../services/gameMasterObjectiveReminder';
import {
  formatGameMasterVoiceHudLabel,
  getGameMasterVoiceTestPhrase,
  speakGameMasterVoice,
  stopGameMasterVoice,
} from '../../services/gameMasterVoice';
import {
  buildRaycastLowHealthWarningMessage,
  getRaycastFeedbackActions,
  shouldPlayRaycastLowHealthWarning,
  type RaycastFeedbackEvent
} from '../raycast/RaycastFeedback';
import {
  applyRaycastHealthPickup,
  buildRaycastLowHealthHint,
  RAYCAST_LOW_HEALTH_HINT_THRESHOLD
} from '../raycast/RaycastItems';
import {
  computeEnemySwarmHealScale,
  computePassiveHealCombatScale,
  formatRaycastPassiveRegenHudLabel,
  getRaycastPassiveRegenHudState,
  tickRaycastPassiveHeal
} from '../raycast/RaycastPassiveHeal';
import {
  formatRaycastControlPauseBody,
  formatRaycastPauseMenuMxBody,
  formatRaycastSettingsPauseBody,
  RAYCAST_PAUSE_MENU_ACTIONS,
  RAYCAST_CONTROL_PAUSE_ROWS,
  RAYCAST_PAUSE_MENU_LABELS,
  RAYCAST_SETTINGS_PAUSE_ROWS
} from '../raycast/RaycastPauseMenu';
import { computeRaycastPausePanelLayout } from '../raycast/RaycastPausePanelLayout';
import {
  applyFpsTargetToGame,
  cycleFpsTarget,
  cycleMinimapQuality,
  cycleRenderQuality,
  formatFpsTargetLabel,
  formatMinimapQualityLabel,
  formatRenderQualityLabel,
  getMinimapStrideForMinimapQuality,
} from '../raycast/RaycastPerformanceSettings';
import {
  formatRaycastGamepadDebugLine,
  formatRaycastGamepadStatusLabel,
  resolveRaycastActiveInput,
  type RaycastActiveInputKind,
  type RaycastActiveInputSnapshot
} from '../raycast/RaycastInputHelp';
import { formatGameMasterHudStatusLine } from '../raycast/GameMasterHudStatus';
import { getBillboardColor } from '../raycast/RaycastVisualTheme';
import { getRaycastBossLevelId, resolveRaycastBossShortcutLevelId, type RaycastBossShortcutSlot } from '../raycast/RaycastBossShortcuts';
import { RaycastGamepadInput } from '../systems/RaycastGamepadInput';
import { RaycastTouchInput } from '../systems/RaycastTouchInput';
import { palette } from '../theme/palette';
import { getSaveManager } from '../save/SaveManager';
import { prepareGameSession } from '../save/persistSessionSettings';
import { NetClient } from '../net/NetClient';
import { NetState } from '../net/NetState';
import type { SnapshotMessage } from '../../../shared/protocol';
import type { EnemyState } from '../../../shared/types';
import { TICK_INTERVAL_MS } from '../../../shared/constants';
import { WEAPON_ORDER } from '../systems/WeaponConfig';
import {
  getAimAssistLevel,
  getCameraSmoothing,
  getGameMasterNarrationDebug,
  getGameMasterNarrationDurationMs,
  getGameMasterNarrationEnabled,
  getGameMasterVoiceEnabled,
  getGameMasterVoiceVolume,
  adjustGameMasterVoiceVolume,
  getMinimapQuality,
  getFpsTarget,
  getRenderQuality,
  setGameMasterNarrationDebug,
  setMinimapQuality,
  getGamepadInvertY,
  getGamepadLeftDeadzone,
  getGamepadRightDeadzone,
  getGamepadSensitivity,
  getGamepadVibrationEnabled,
  getMinimapDefaultVisible,
  getMouseSensitivity,
  getScreenshakeEnabled,
  getSessionMasterVolume,
  getTouchButtonScale,
  getTouchControlsEnabled,
  getTouchJoystickDeadzone,
  getTouchLookSensitivity,
  setGameMasterNarrationEnabled,
  setGameMasterVoiceEnabled,
  setFpsTarget,
  setRenderQuality,
  setGamepadInvertY,
  setGamepadLeftDeadzone,
  setGamepadRightDeadzone,
  setGamepadSensitivity,
  setGamepadVibrationEnabled,
  setMinimapDefaultVisible,
  setMouseSensitivity,
  setScreenshakeEnabled,
  setSessionMasterVolume
} from '../sessionSettings';

interface RaycastSceneData {
  levelId?: string;
  difficultyId?: RaycastDifficultyId;
  /** Carry cumulative score when advancing to the next map in an episode. */
  carryScore?: number;
  /** Carry merged campaign metrics (pellets, damage, secrets, wall time). */
  carryCampaignMetrics?: RaycastCampaignMetrics;
  /** First World 2 map after Episode 1 boss — applies one-time breach bonus. */
  breachWorldTwo?: boolean;
  /** First World 3 map after World 2 finale — applies one-time breach bonus. */
  breachWorldThree?: boolean;
  /** Campaign-per-run permanent buffs from boss clears. */
  rewardTier?: number;
  /** Optional pre-run/world roulette modifier. */
  runModifierId?: RunModifierId | null;
  // ── Multiplayer / co-op ──────────────────────────────────────────────────
  /** When true the scene connects to a WebSocket server and enters co-op mode. */
  netMode?: boolean;
  /** WebSocket URL of the co-op server (e.g. "ws://192.168.1.10:3001"). */
  serverUrl?: string;
  /** Player display name shown to other clients. */
  playerName?: string;
}

const DIRECTOR_SPAWN_TELEGRAPH_MS = 820;
const ENCOUNTER_SPAWN_TELEGRAPH_MS = 980;
const DEV_SHORTCUT_ENABLED = import.meta.env.DEV;
const BASE_PLAYER_MAX_HEALTH = 100;
const REWARD_DAMAGE_STEP = 0.2;
const REWARD_HEALTH_STEP = 1.2;
const FIRE_SHAKE_DURATION_MS = 58;
const FIRE_SHAKE_INTENSITY = 0.00105;
const FIRE_SHAKE_INTENSITY_CAP = 0.0028;
const FIRE_MUZZLE_ALPHA_CAP = 0.97;
type RaycastPausePanelMode = 'main' | 'settings' | 'control';

export class RaycastScene extends Phaser.Scene {
  private raycastRenderer!: RaycastRenderer;
  private controller!: RaycastPlayerController;
  private gamepadInput!: RaycastGamepadInput;
  private touchInput!: RaycastTouchInput;
  private combat!: RaycastCombatSystem;
  private audioFeedback!: AudioFeedbackSystem;
  private gameDirector!: GameDirector;
  private keySystem!: KeySystem;
  private doorSystem!: DoorSystem;
  private triggerSystem!: TriggerSystem;
  private currentLevel: RaycastLevel = RAYCAST_LEVEL;
  private map!: RaycastMap;
  private enemies: RaycastEnemy[] = [];
  private enemyProjectiles: RaycastEnemyProjectile[] = [];
  private player: RaycastPlayerState = { ...RAYCAST_PLAYER_START };
  private playerHealth = BASE_PLAYER_MAX_HEALTH;
  private playerMaxHealth = BASE_PLAYER_MAX_HEALTH;
  private rewardTier = 0;
  private damageTaken = 0;
  private runStartedAt = 0;
  private playerAlive = true;
  private levelComplete = false;
  private episodeComplete = false;
  private nextLevelId: string | null = null;
  private readonly collectedSecrets = new Set<string>();
  private readonly collectedHealthPickups = new Set<string>();
  private readonly completedEncounterBeats = new Set<string>();
  private readonly deferredPickupHints = new Map<string, number>();
  private enemiesKilled = 0;
  /** Pellets fired / hostile-connecting hits — Phase 24 instrumentation for future scoring (not yet shown in HUD overlay). */
  private runPelletsFired = 0;
  private runPelletsHitHostile = 0;
  /** Boss arena only — while Archon lives (efficiency / damage splits). */
  private runBossPelletsFired = 0;
  private runBossPelletsHitHostile = 0;
  private runBossDamageTaken = 0;
  private runScore = 0;
  /** Cross-sector aggregate for finale scoring + summary (Phase 26). */
  private campaignMetrics!: RaycastCampaignMetrics;
  private carriedScoreFromEpisode = 0;
  private levelStartScore = 0;
  private levelStartCampaignMetrics: RaycastCampaignMetrics = createEmptyCampaignMetrics();
  /** Episode ribbon for pause menu world column (no on-screen HUD label). */
  private pauseRunBannerLine = '';
  private pendingWorldTwoBreachBonus = false;
  private pendingWorldThreeBreachBonus = false;
  private bossStates: RaycastBossState[] = [];
  private playerStationaryMs = 0;
  private lastPlayerDamageAt = 0;
  private lastPlayerPosition: { x: number; y: number } = { x: RAYCAST_PLAYER_START.x, y: RAYCAST_PLAYER_START.y };
  private activeZoneId: string | null = null;
  private directorDebug: DirectorDebugInfo | null = null;
  private lastDirectorState: DirectorState | null = null;
  private directorIntensity = 0;
  private directorSpawnCounter = 0;
  private readonly encounterPatternCooldownUntil = new Map<string, number>();
  private debugHudVisible = false;
  private perfHudVisible = false;
  private frameStats: RaycastFrameStatsState = createRaycastFrameStatsState();
  private narrationOverlay!: RaycastNarrationOverlay;
  private gameMasterNarration!: GameMasterNarrationBridge;
  private lastGmSource: GameMasterSource | null = null;
  private lastGmTier: GameMasterNarrationTier | null = null;
  private adaptiveQuality = createRaycastAdaptiveQualityState();
  private narrationOverlayTick = 0;
  private lastObjectiveReminderAtMs = 0;
  private minimapVisible = true;
  private helpOverlayVisible = false;
  private gamePaused = false;
  private pauseSelectionIndex = 0;
  private pauseControlSelectionIndex = 1;
  private pausePanelMode: RaycastPausePanelMode = 'main';
  private pauseSettingsSelectionIndex = 0;
  private detectedActiveInputKind: RaycastActiveInputKind = 'keyboard_mouse';
  private passiveRegenHudActive = false;
  private passiveRegenHudLabel: string | null = null;
  private passiveHealFractionalCarry = 0;
  private runUsedPassiveRegen = false;
  private masteryUnlockState: RaycastMasteryUnlockState = readRaycastMasteryUnlockState();
  private readonly runClearedLevelIds = new Set<string>();
  private readonly runRankByLevelId = new Map<string, 'SS' | 'S' | 'A' | 'B' | 'C' | 'D'>();
  private bossHazards: RaycastBossHazardState | null = null;
  private audioMasterVolume = 1;
  private billboardSig = '';
  private cachedBillboards: RaycastBillboard[] = [];
  // ── Multiplayer / co-op net state ──────────────────────────────────────────
  private netClient: NetClient | null = null;
  private netState: NetState | null = null;
  private netConnected = false;
  private netInputThrottle = 0;
  // True during a server-driven level transition: keeps the WebSocket alive across scene.restart().
  private netTransitioning = false;
  private netServerUrl: string | null = null;
  private netPlayerName: string | null = null;
  private minimapFrameCounter = 0;
  private readonly minimapKeyIdScratch: string[] = [];
  private readonly minimapDoorIdScratch: string[] = [];
  private readonly minimapEnemyBlipScratch: RaycastMinimapEnemyBlip[] = [];
  private readonly minimapHazardMarkerScratch: RaycastBossHazardMarker[] = [];
  /** Invalidated when a door mutates the map grid (`openRaycastDoor`). */
  private mapLayoutRevision = 0;
  private minimapStaticCellsCacheKey = '';
  private minimapStaticCells: RaycastMinimapCell[] | null = null;
  private readonly minimapLabeledMarkerScratch: RaycastMinimapMarker[] = [];
  private pauseDim!: Phaser.GameObjects.Rectangle;
  private pausePanel!: Phaser.GameObjects.Rectangle;
  private pauseTitleText!: Phaser.GameObjects.Text;
  private pauseMenuBodyText!: Phaser.GameObjects.Text;
  private muzzleFlashAnchorY = GAME_HEIGHT - 54;
  private debugText!: Phaser.GameObjects.Text;
  private perfText!: Phaser.GameObjects.Text;
  private healthText!: Phaser.GameObjects.Text;
  private targetText!: Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;
  private healthBarTrack!: Phaser.GameObjects.Rectangle;
  private healthBarFill!: Phaser.GameObjects.Rectangle;
  private targetBarTrack!: Phaser.GameObjects.Rectangle;
  private targetBarFill!: Phaser.GameObjects.Rectangle;
  private bossNameText!: Phaser.GameObjects.Text;
  private bossPhaseText!: Phaser.GameObjects.Text;
  private bossBarTrack!: Phaser.GameObjects.Rectangle;
  private bossBarFill!: Phaser.GameObjects.Rectangle;
  private bossNameTextSecondary!: Phaser.GameObjects.Text;
  private bossBarTrackSecondary!: Phaser.GameObjects.Rectangle;
  private bossBarFillSecondary!: Phaser.GameObjects.Rectangle;
  private objectiveText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private instructionText!: Phaser.GameObjects.Text;
  private scoreHudText!: Phaser.GameObjects.Text;
  private minimapFrame!: Phaser.GameObjects.Rectangle;
  private minimapTitleText!: Phaser.GameObjects.Text;
  private helpOverlayFrame!: Phaser.GameObjects.Rectangle;
  private helpOverlayTitleText!: Phaser.GameObjects.Text;
  private helpOverlayText!: Phaser.GameObjects.Text;
  private minimapGraphics!: Phaser.GameObjects.Graphics;
  private minimapMarkerLabels: Phaser.GameObjects.Text[] = [];
  private muzzleFlash!: Phaser.GameObjects.Rectangle;
  private wallImpactFlash!: Phaser.GameObjects.Arc;
  private damageFlash!: Phaser.GameObjects.Rectangle;
  private damageFrameTop!: Phaser.GameObjects.Rectangle;
  private damageFrameBottom!: Phaser.GameObjects.Rectangle;
  private damageFrameLeft!: Phaser.GameObjects.Rectangle;
  private damageFrameRight!: Phaser.GameObjects.Rectangle;
  private feedbackPulse!: Phaser.GameObjects.Rectangle;
  private corruptionVeil!: Phaser.GameObjects.Rectangle;
  private systemText!: Phaser.GameObjects.Text;
  private pickupToastText!: Phaser.GameObjects.Text;
  private pickupToastQueue: RaycastPickupToastQueueState = createRaycastPickupToastQueue();
  private pickupToastLayout = { x: 0, y: 0, maxWidth: 320 };
  private crosshair!: Phaser.GameObjects.Text;
  private hitMarker!: Phaser.GameObjects.Text;
  private finalOverlay!: Phaser.GameObjects.Rectangle;
  private finalTitleText!: Phaser.GameObjects.Text;
  private finalSummaryText!: Phaser.GameObjects.Text;
  private finalHintText!: Phaser.GameObjects.Text;
  private weaponOverlayFlashUntil = 0;
  private combatFeelState: CombatFeelRuntimeState = createCombatFeelRuntimeState();
  private freezeFrameUntil = 0;
  private bossTelegraphById = new Map<string, boolean>();
  private lastBossPhaseById = new Map<string, 1 | 2 | 3>();
  private bossIntroUntil = 0;
  private lastCombatMessage: string = RAYCAST_ATMOSPHERE.messages.intro;
  private hudCss!: RaycastHudCssBundle;
  private combatMessageUntil = 0;
  private blockedHintReason: RaycastBlockedReason | null = null;
  private blockedHintUntil = 0;
  private lastLowHealthWarningAt: number | null = null;
  private nextAmbientCueAt = 0;
  private sceneReady = false;
  private inputListenersRegistered = false;
  private difficultyId: RaycastDifficultyId = DEFAULT_RAYCAST_DIFFICULTY_ID;
  private runModifier: RunModifier | null = null;
  private activeLevelEvent!: RaycastLevelEventDefinition;
  private hudObjectiveJamText: string | null = null;
  private hudHintJamText: string | null = null;
  private nextHudJamAt = 0;
  private nextCorruptionZoneAt = 0;
  private corruptionZone: { x: number; y: number; radius: number; expiresAt: number; nextTickAt: number } | null = null;
  private blackoutPulseUntil = 0;
  private flashBlindUntil = 0;
  private lastDevShortcutAt = 0;
  private nextBossAddSpawnAt = 0;

  private readonly handleExitToMenu = (): void => {
    if (!this.isRaycastSceneActive()) return;
    this.gamePaused = false;
    this.stopGameMasterPresentation('exit_menu');
    this.scene.start('MenuScene');
  };

  private readonly handleRetry = (): void => {
    if (!this.isRaycastSceneActive()) return;
    if (this.gamePaused) return;
    if (this.playerAlive && !this.levelComplete) {
      const started = this.combat.tryReload(this.time.now);
      if (started) this.setCombatMessage('RECARGANDO...');
      return;
    }
    // In co-op the server controls respawn — do not restart the level locally.
    if (this.netConnected) return;
    this.restartCurrentLevel();
  };

  private readonly handleRestartLevel = (): void => {
    if (!this.isRaycastSceneActive()) return;
    if (this.gamePaused) return;
    this.restartCurrentLevel();
  };

  private restartCurrentLevel(): void {
    this.stopGameMasterPresentation('restart_level');
    this.scene.restart({
      levelId: this.currentLevel.id,
      difficultyId: this.difficultyId,
      carryScore: this.levelStartScore,
      carryCampaignMetrics: this.levelStartCampaignMetrics,
      rewardTier: this.rewardTier,
      runModifierId: this.runModifier?.id ?? null
    });
  }

  private readonly handleAdvanceLevel = (): void => {
    if (!this.isRaycastSceneActive()) return;
    if (this.gamePaused) return;
    // In co-op, the server drives level transitions via the levelChange event — do not restart locally.
    if (this.netConnected) return;
    if (!this.levelComplete || this.episodeComplete || this.nextLevelId === null) return;
    const nextId = this.nextLevelId;
    const breachWorldTwo =
      Boolean(this.currentLevel.bossConfig) && nextId === RAYCAST_WORLD_TWO_CATALOG[0]?.id;
    const breachWorldThree =
      this.currentLevel.id === RAYCAST_WORLD_TWO_CATALOG[RAYCAST_WORLD_TWO_CATALOG.length - 1]?.id &&
      nextId === RAYCAST_WORLD_THREE_CATALOG[0]?.id;
    this.stopGameMasterPresentation('level_transition');
    this.scene.restart({
      levelId: nextId,
      difficultyId: this.difficultyId,
      carryScore: this.runScore,
      carryCampaignMetrics: this.campaignMetrics,
      rewardTier: this.rewardTier,
      breachWorldTwo,
      breachWorldThree,
      runModifierId: this.runModifier?.id ?? null
    });
  };

  private readonly handleWorldTwoPlaceholder = (): void => {
    if (!this.isRaycastSceneActive()) return;
    if (this.gamePaused) return;
    if (!this.levelComplete || !this.episodeComplete || !this.currentLevel.bossConfig) return;
    if (RAYCAST_WORLD_TWO_CATALOG.length > 0) return;
    this.stopGameMasterPresentation('scene_change');
    this.scene.start('RaycastWorldLockedScene');
  };

  private readonly handleFireInput = (pointer?: Phaser.Input.Pointer): void => {
    if (pointer && (pointer.event as PointerEvent | undefined)?.pointerType === 'touch') return;
    if (this.gamePaused) return;
    this.fireWeapon();
  };

  private readonly handleWeaponSlotOne = (): void => {
    if (this.gamePaused) return;
    this.switchWeapon(1);
  };

  private readonly handleWeaponSlotTwo = (): void => {
    if (this.gamePaused) return;
    this.switchWeapon(2);
  };

  private readonly handleWeaponSlotThree = (): void => {
    if (this.gamePaused) return;
    this.switchWeapon(3);
  };

  private readonly handleToggleDebug = (): void => {
    if (this.gamePaused) return;
    this.applyDebugHudToggle();
  };

  private readonly handleTogglePerfHud = (): void => {
    if (this.gamePaused) return;
    this.perfHudVisible = !this.perfHudVisible;
    this.perfText?.setVisible(this.perfHudVisible);
  };

  private readonly handleObjectiveReminderKey = (): void => {
    if (!this.isRaycastSceneActive() || this.gamePaused || !this.playerAlive || this.levelComplete) {
      return;
    }
    if (
      !getGameMasterNarrationEnabled(this.registry) &&
      !getGameMasterVoiceEnabled(this.registry)
    ) {
      return;
    }
    const now = this.time.now;
    if (now - this.lastObjectiveReminderAtMs < GM_OBJECTIVE_REMINDER_COOLDOWN_MS) return;
    this.lastObjectiveReminderAtMs = now;
    const message = buildGameMasterObjectiveReminderMessage(
      this.getObjectiveState(),
      this.currentLevel.hudObjectiveLabels,
    );
    this.deliverGameMasterNarration(message, 'fallback', 'important');
  };

  private readonly handleGameMasterTestKey = (): void => {
    if (!this.isRaycastSceneActive() || this.gamePaused) return;
    if (getGameMasterVoiceEnabled(this.registry)) {
      const phrase = getGameMasterVoiceTestPhrase();
      if (getGameMasterNarrationEnabled(this.registry)) {
        this.deliverGameMasterNarration(phrase, 'fallback', 'important');
      } else {
        speakGameMasterVoice(phrase, {
          urgent: true,
          volume: getGameMasterVoiceVolume(this.registry),
          tier: 'important',
        });
      }
      return;
    }
    this.emitGameMasterNarration('manual_debug', {}, `g-${Math.floor(this.time.now)}`);
  };

  private readonly handleToggleMinimap = (): void => {
    if (this.gamePaused) return;
    this.applyMinimapToggle();
  };

  private readonly handleToggleHelp = (): void => {
    if (this.gamePaused) return;
    this.helpOverlayVisible = !this.helpOverlayVisible;
    this.helpOverlayFrame?.setVisible(this.helpOverlayVisible);
    this.helpOverlayTitleText?.setVisible(this.helpOverlayVisible);
    this.helpOverlayText?.setVisible(this.helpOverlayVisible);
  };

  private readonly handleHelpShortcut = (event: KeyboardEvent): void => {
    if (this.gamePaused) return;
    if (event.shiftKey) this.handleToggleHelp();
  };

  private handleDevJumpToLevel(levelId: string, label: string): void {
    if (this.gamePaused || !this.isRaycastSceneActive()) return;
    this.setCombatMessage(`SALTO // ${label.toUpperCase()}`, 2000);
    this.scene.restart({
      levelId,
      difficultyId: this.difficultyId,
      carryScore: this.runScore,
      carryCampaignMetrics: this.campaignMetrics,
      rewardTier: this.rewardTier,
      runModifierId: this.runModifier?.id ?? null
    });
  }

  private readonly handleDevBossShortcut = (event: KeyboardEvent): void => {
    const levelId = resolveRaycastBossShortcutLevelId(event);
    if (!levelId) return;
    const now = this.time.now;
    if (now - this.lastDevShortcutAt < 140) return;
    this.lastDevShortcutAt = now;
    const world2BossId = RAYCAST_WORLD_TWO_CATALOG.find((level) => level.id === 'bloom-warden-pit')?.id;
    const label = levelId === RAYCAST_LEVEL_BOSS.id ? 'Jefe Mundo 1' : levelId === world2BossId ? 'Jefe Mundo 2' : 'Jefe Mundo 3';
    this.handleDevJumpToLevel(levelId, label);
  };

  private readonly handleDevShiftJ = (event: KeyboardEvent): void => {
    if (!DEV_SHORTCUT_ENABLED) return;
    if (!event.shiftKey) return;
    const world3Boss = RAYCAST_WORLD_THREE_CATALOG[RAYCAST_WORLD_THREE_CATALOG.length - 1];
    if (!world3Boss) return;
    this.handleDevJumpToLevel(world3Boss.id, 'World 3 Boss');
  };

  private jumpToBossArena(slot: RaycastBossShortcutSlot): void {
    if (!this.isRaycastSceneActive()) return;
    this.scene.restart({
      levelId: getRaycastBossLevelId(slot),
      difficultyId: this.difficultyId,
      carryScore: 0,
      carryCampaignMetrics: createEmptyCampaignMetrics(),
      rewardTier: 0,
      runModifierId: this.runModifier?.id ?? null
    });
  }

  private readonly handleBossShortcutOne = (): void => {
    this.jumpToBossArena(1);
  };

  private readonly handleBossShortcutTwo = (): void => {
    this.jumpToBossArena(2);
  };

  private readonly handleBossShortcutThree = (): void => {
    this.jumpToBossArena(3);
  };

  private readonly handleEscKey = (): void => {
    if (!this.isRaycastSceneActive()) return;
    if (this.gamePaused) {
      if (this.pausePanelMode === 'control') {
        this.closeControlSettingsPanel();
        return;
      }
      if (this.pausePanelMode === 'settings') {
        this.closeSettingsPanel();
        return;
      }
      this.closePauseMenu();
      return;
    }
    if (this.playerAlive && !this.levelComplete) {
      this.openPauseMenu();
      return;
    }
    this.handleExitToMenu();
  };

  private getActiveInputSnapshot(): RaycastActiveInputSnapshot {
    return {
      gamepadConnected: this.gamepadInput?.isConnected() ?? false,
      touchActive: this.touchInput?.isActive() ?? false,
      touchControlsEnabled: getTouchControlsEnabled(this.registry)
    };
  }

  private resolveSceneActiveInput(): RaycastActiveInputKind {
    return resolveRaycastActiveInput(this.getActiveInputSnapshot(), this.detectedActiveInputKind);
  }

  private markDetectedActiveInput(kind: RaycastActiveInputKind): void {
    if (this.detectedActiveInputKind === kind) return;
    this.detectedActiveInputKind = kind;
    if (this.gamePaused) this.refreshPauseMenuBody();
  }

  private trackConnectedInputActivity(): void {
    if (this.touchInput?.isActive()) {
      this.markDetectedActiveInput('touch');
      return;
    }
    if (this.gamepadInput?.isConnected()) {
      this.markDetectedActiveInput('gamepad');
    }
  }

  private readonly handlePauseMenuUp = (): void => {
    this.markDetectedActiveInput('keyboard_mouse');
    if (!this.gamePaused) return;
    if (this.pausePanelMode === 'control') {
      this.pauseControlSelectionIndex = this.getWrappedControlSelectionIndex(-1);
    } else if (this.pausePanelMode === 'settings') {
      this.pauseSettingsSelectionIndex = this.getWrappedSettingsSelectionIndex(-1);
    } else {
      this.pauseSelectionIndex =
        (this.pauseSelectionIndex + RAYCAST_PAUSE_MENU_LABELS.length - 1) % RAYCAST_PAUSE_MENU_LABELS.length;
    }
    this.refreshPauseMenuBody();
  };

  private readonly handlePauseMenuDown = (): void => {
    this.markDetectedActiveInput('keyboard_mouse');
    if (!this.gamePaused) return;
    if (this.pausePanelMode === 'control') {
      this.pauseControlSelectionIndex = this.getWrappedControlSelectionIndex(1);
    } else if (this.pausePanelMode === 'settings') {
      this.pauseSettingsSelectionIndex = this.getWrappedSettingsSelectionIndex(1);
    } else {
      this.pauseSelectionIndex = (this.pauseSelectionIndex + 1) % RAYCAST_PAUSE_MENU_LABELS.length;
    }
    this.refreshPauseMenuBody();
  };

  private readonly handlePauseMenuLeft = (): void => {
    this.markDetectedActiveInput('keyboard_mouse');
    if (!this.gamePaused) return;
    if (this.pausePanelMode === 'control' || this.pausePanelMode === 'settings') {
      this.adjustPauseSubmenuSetting(-1);
    }
  };

  private readonly handlePauseMenuRight = (): void => {
    this.markDetectedActiveInput('keyboard_mouse');
    if (!this.gamePaused) return;
    if (this.pausePanelMode === 'control' || this.pausePanelMode === 'settings') {
      this.adjustPauseSubmenuSetting(1);
    }
  };

  private readonly handlePauseMenuPointerDown = (pointer?: Phaser.Input.Pointer): void => {
    if (!this.gamePaused) return;
    if (pointer && (pointer.event as PointerEvent | undefined)?.pointerType === 'touch') return;
    this.handlePauseMenuConfirm();
  };

  private readonly handlePauseMenuWheel = (_pointer: Phaser.Input.Pointer, _gameObjects: unknown, _dx: number, dy: number): void => {
    if (!this.gamePaused) return;
    if (dy > 0) this.handlePauseMenuDown();
    else if (dy < 0) this.handlePauseMenuUp();
  };

  private readonly handlePauseMenuConfirm = (): void => {
    if (!this.gamePaused) return;
    if (this.pausePanelMode === 'control') {
      if (RAYCAST_CONTROL_PAUSE_ROWS[this.pauseControlSelectionIndex] === 'back') {
        this.closeControlSettingsPanel();
        return;
      }
      this.adjustControlSetting(1);
      return;
    }

    if (this.pausePanelMode === 'settings') {
      const row = RAYCAST_SETTINGS_PAUSE_ROWS[this.pauseSettingsSelectionIndex];
      if (row === 'back') {
        this.closeSettingsPanel();
        return;
      }
      if (row === 'gm_test') {
        this.triggerGameMasterTestFromPause();
        return;
      }
      this.adjustSettingsSetting(1);
      return;
    }

    const action = RAYCAST_PAUSE_MENU_ACTIONS[this.pauseSelectionIndex];
    switch (action) {
      case 'resume':
        this.closePauseMenu();
        break;
      case 'restart':
        this.closePauseMenu();
        this.scene.restart({
          levelId: this.currentLevel.id,
          difficultyId: this.difficultyId,
          carryScore: this.levelStartScore,
          carryCampaignMetrics: this.levelStartCampaignMetrics,
          rewardTier: this.rewardTier,
          runModifierId: this.runModifier?.id ?? null
        });
        break;
      case 'settings':
        this.openSettingsPanel();
        break;
      case 'controls':
        this.openControlSettingsPanel();
        break;
      case 'menu':
        this.closePauseMenu();
        this.handleExitToMenu();
        break;
      case 'vol_up':
        this.adjustAudioMasterVolume(0.1);
        break;
      case 'vol_down':
        this.adjustAudioMasterVolume(-0.1);
        break;
      case 'minimap':
        this.applyMinimapToggle();
        break;
      case 'debug':
        this.applyDebugHudToggle();
        break;
      default:
        break;
    }
    this.refreshPauseMenuBody();
  };

  constructor() {
    super('RaycastScene');
  }

  init(data: RaycastSceneData = {}): void {
    this.currentLevel = getRaycastLevelById(data.levelId);
    this.nextLevelId = resolveRaycastNextLevelId(this.currentLevel.id);
    this.difficultyId = getRaycastDifficultyPreset(data.difficultyId ?? this.registry.get(RAYCAST_DIFFICULTY_REGISTRY_KEY)).id;
    this.registry.set(RAYCAST_DIFFICULTY_REGISTRY_KEY, this.difficultyId);
    this.carriedScoreFromEpisode = data.carryScore ?? 0;
    this.pendingWorldTwoBreachBonus = Boolean(data.breachWorldTwo);
    this.pendingWorldThreeBreachBonus = Boolean(data.breachWorldThree);
    this.campaignMetrics = data.carryCampaignMetrics ?? createEmptyCampaignMetrics();
    this.rewardTier = Math.max(0, data.rewardTier ?? 0);
    this.runModifier = getRunModifierById(data.runModifierId ?? null);

    // ── Multiplayer: connect to co-op server (or reuse live socket after level transition) ──
    this.netTransitioning = false;

    if (data.netMode) {
      this.netServerUrl = data.serverUrl ?? null;
      this.netPlayerName = data.playerName ?? 'Player';
      this.netInputThrottle = 0;

      const existingClient = this.registry.get('coopNetClient') as NetClient | null;
      if (existingClient) {
        // Level transition: reuse the live WebSocket — no reconnect needed.
        this.netClient = existingClient;
        this.netState = (this.registry.get('coopNetState') as NetState | null) ?? new NetState();
        this.registry.remove('coopNetClient');
        this.registry.remove('coopNetState');
        this.netState.localPlayerId = this.netClient.playerId;
        this.registerNetHandlers();
        this.netConnected = true;
      } else if (data.serverUrl) {
        // Fresh connection from menu.
        this.netClient = new NetClient();
        this.netState = new NetState();
        this.netConnected = false;
        const playerName = this.netPlayerName;
        const serverUrl = data.serverUrl;
        this.netClient.connect(serverUrl, playerName).then(() => {
          if (!this.netClient || !this.netState) return;
          this.netState.localPlayerId = this.netClient.playerId;
          this.registerNetHandlers();
          this.netConnected = true;
        }).catch((err: unknown) => {
          console.warn('[RaycastScene] multiplayer connect failed:', err);
          this.netClient = null;
          this.netState = null;
          this.netConnected = false;
        });
      } else {
        this.netClient = null;
        this.netState = null;
        this.netConnected = false;
      }
    } else {
      this.netClient = null;
      this.netState = null;
      this.netConnected = false;
    }
  }

  create(): void {
    registerRaycastOptionalAssets(this);
    prepareGameSession(this.registry);
    this.applyPerformanceSettings();
    this.resetRuntimeState();
    this.cameras.main.setBackgroundColor(
      this.getWorldSegment() === 'world2' ? '#030612' : this.getWorldSegment() === 'world3' ? '#0c0604' : '#05070c'
    );
    this.map = cloneRaycastMap(this.currentLevel.map);
    this.keySystem = new KeySystem();
    this.doorSystem = new DoorSystem(this.keySystem);
    this.triggerSystem = new TriggerSystem();
    this.gamepadInput = new RaycastGamepadInput({
      getSettings: () => ({
        leftDeadzone: getGamepadLeftDeadzone(this.registry),
        rightDeadzone: getGamepadRightDeadzone(this.registry),
        lookSensitivity: getGamepadSensitivity(this.registry),
        invertLookY: getGamepadInvertY(this.registry),
        vibrationEnabled: getGamepadVibrationEnabled(this.registry)
      })
    });
    this.touchInput = new RaycastTouchInput(this, {
      mode: 'gameplay',
      getSettings: () => ({
        enabled: getTouchControlsEnabled(this.registry),
        buttonScale: getTouchButtonScale(this.registry),
        lookSensitivity: getTouchLookSensitivity(this.registry),
        joystickDeadzone: getTouchJoystickDeadzone(this.registry)
      })
    });
    this.touchInput.create();
    this.raycastRenderer = new RaycastRenderer(this, this.map, this.currentLevel);
    this.controller = new RaycastPlayerController(
      this,
      this.map,
      this.player,
      RAYCAST_MOVEMENT,
      () => getMouseSensitivity(this.registry),
      this.gamepadInput,
      this.touchInput,
      () => !this.gamePaused,
      {
        getLookFeelSettings: () => ({
          aimAssist: getAimAssistLevel(this.registry),
          cameraSmoothing: getCameraSmoothing(this.registry),
          stickSensitivity: getGamepadSensitivity(this.registry),
          touchLookSensitivity: getTouchLookSensitivity(this.registry),
          gamepadLookDeadzone: getGamepadRightDeadzone(this.registry),
          touchDeadzone: getTouchJoystickDeadzone(this.registry)
        }),
        getLookContext: () => ({
          enemies: this.enemies,
          wallDistance: castRay(this.map, this.player.x, this.player.y, this.player.angle, this.player.angle).distance
        }),
        isGamepadAimActive: () => this.gamepadInput.isConnected() && !this.gamePaused,
        isTouchAimActive: () => this.touchInput.isActive() && !this.gamePaused
      }
    );
    this.controller.create();
    this.controller.setMoveSpeedMultiplier(
      (this.activeLevelEvent.effects.playerMoveMultiplier ?? 1) * (this.runModifier?.effects.moveSpeedMul ?? 1)
    );
    this.combat = new RaycastCombatSystem();
    this.combat.setPlayerDamageMultiplier(this.getPlayerDamageMultiplier());
    this.combat.setWeaponFireRateMultiplier(
      (this.activeLevelEvent.effects.ammoCadenceMultiplier ?? 1) * (this.runModifier?.effects.fireRateMul ?? 1)
    );
    this.audioMasterVolume = getSessionMasterVolume(this.registry);
    this.audioFeedback = new AudioFeedbackSystem();
    this.audioFeedback.setMasterVolume(this.audioMasterVolume);
    this.gameDirector = new GameDirector({
      config: createRaycastDifficultyDirectorConfig(this.currentLevel.director.config, this.difficultyId),
      spawnPoints: this.currentLevel.director.spawnPoints
    });
    this.enemies = this.buildLevelEnemiesForEvent();
    const hudLayout = buildRaycastHudLayout(GAME_WIDTH, GAME_HEIGHT);
    const difficultyPreset = getRaycastDifficultyPreset(this.difficultyId);
    this.hudCss = getRaycastHudCss(this.getWorldSegment());
    const segment = this.getWorldSegment();
    const ionHudAccent =
      segment === 'world2' ? RAYCAST_PALETTE.riftIon : segment === 'world3' ? RAYCAST_PALETTE.amberWarn : RAYCAST_PALETTE.plasmaBright;

    const episodeState = getRaycastEpisodeState(this.currentLevel.id);
    const worldTwoIndex = RAYCAST_WORLD_TWO_CATALOG.findIndex((entry) => entry.id === this.currentLevel.id);
    const worldThreeIndex = RAYCAST_WORLD_THREE_CATALOG.findIndex((entry) => entry.id === this.currentLevel.id);
    this.pauseRunBannerLine =
      worldThreeIndex >= 0
        ? buildRaycastEpisodeBanner({
            currentLevelNumber: episodeState.currentLevelNumber,
            totalLevels: episodeState.totalLevels,
            levelName: this.currentLevel.name,
            worldThreeSector: { index: worldThreeIndex + 1, total: RAYCAST_WORLD_THREE_CATALOG.length }
          })
        : worldTwoIndex >= 0
          ? buildRaycastEpisodeBanner({
              currentLevelNumber: episodeState.currentLevelNumber,
              totalLevels: episodeState.totalLevels,
              levelName: this.currentLevel.name,
              worldTwoSector: { index: worldTwoIndex + 1, total: RAYCAST_WORLD_TWO_CATALOG.length }
            })
          : buildRaycastEpisodeBanner({
              currentLevelNumber: episodeState.currentLevelNumber,
              totalLevels: episodeState.totalLevels,
              levelName: this.currentLevel.name
            });

    this.scoreHudText = this.add
      .text(hudLayout.scoreHudTextX, hudLayout.scoreHudTextY, buildRaycastScoreHudLine(this.runScore, readRaycastHighScore()), {
        fontSize: '11px',
        fontStyle: '700',
        color: palette.accent.terminalText,
        backgroundColor: this.hudCss.hudPanel,
        padding: { x: 8, y: 4 }
      })
      .setDepth(10)
      .setOrigin(1, 0)
      .setVisible(false);

    this.crosshair = this.add
      .text(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, '+', {
        fontSize: '26px',
        fontStyle: '700',
        color: '#fff0c2',
        stroke: '#05070c',
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(12);

    this.healthText = this.add
      .text(hudLayout.healthTextX, hudLayout.healthTextY, '', {
        fontSize: '14px',
        fontStyle: '700',
        color: this.hudCss.accentText,
        backgroundColor: this.hudCss.hudPanel,
        padding: { x: 8, y: 5 }
      })
      .setOrigin(1, 0)
      .setDepth(12);
    this.healthBarTrack = this.add
      .rectangle(
        hudLayout.healthBarX,
        hudLayout.healthBarY,
        hudLayout.healthBarWidth,
        hudLayout.healthBarTrackHeight,
        0x020408,
        0.9
      )
      .setOrigin(0, 0.5)
      .setDepth(12);
    this.healthBarFill = this.add
      .rectangle(
        hudLayout.healthBarX,
        hudLayout.healthBarY,
        hudLayout.healthBarWidth,
        hudLayout.healthBarFillHeight,
        ionHudAccent,
        1
      )
      .setOrigin(0, 0.5)
      .setDepth(13);

    this.weaponText = this.add
      .text(hudLayout.weaponTextX, hudLayout.weaponTextY, '', {
        fontSize: '13px',
        fontStyle: '700',
        color: palette.accent.warmText,
        backgroundColor: this.hudCss.hudPanel,
        padding: { x: 8, y: 5 }
      })
      .setOrigin(1, 0)
      .setDepth(12);
    this.targetText = this.add
      .text(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5 + 34, '', {
        fontSize: '14px',
        fontStyle: '700',
        color: '#fff0c2',
        backgroundColor: '#020408cc',
        padding: { x: 8, y: 4 }
      })
      .setOrigin(0.5)
      .setDepth(14)
      .setVisible(false);
    this.targetBarTrack = this.add
      .rectangle(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5 + 58, 118, 8, 0x020408, 0.88)
      .setDepth(14)
      .setVisible(false);
    this.targetBarFill = this.add
      .rectangle(GAME_WIDTH * 0.5 - 59, GAME_HEIGHT * 0.5 + 58, 118, 4, 0xfff29e, 1)
      .setOrigin(0, 0.5)
      .setDepth(15)
      .setVisible(false);
    this.bossNameText = this.add
      .text(GAME_WIDTH * 0.5, 44, '', {
        fontSize: '18px',
        fontStyle: '700',
        color: '#ffd07a',
        stroke: '#020408',
        strokeThickness: 5
      })
      .setOrigin(0.5, 0.5)
      .setDepth(16)
      .setVisible(false);
    this.bossPhaseText = this.add
      .text(GAME_WIDTH * 0.5, 66, '', {
        fontSize: '12px',
        fontStyle: '700',
        color: '#ffe7b8',
        stroke: '#020408',
        strokeThickness: 4
      })
      .setOrigin(0.5, 0.5)
      .setDepth(16)
      .setVisible(false);
    this.bossBarTrack = this.add
      .rectangle(GAME_WIDTH * 0.5, 86, 430, 16, 0x020408, 0.92)
      .setDepth(16)
      .setVisible(false);
    this.bossBarFill = this.add
      .rectangle(GAME_WIDTH * 0.5 - 215, 86, 430, 10, 0xb84fff, 1)
      .setOrigin(0, 0.5)
      .setDepth(17)
      .setVisible(false);
    this.bossNameTextSecondary = this.add
      .text(GAME_WIDTH * 0.5, 104, '', {
        fontSize: '12px',
        fontStyle: '700',
        color: '#ffc88f',
        stroke: '#020408',
        strokeThickness: 3
      })
      .setOrigin(0.5, 0.5)
      .setDepth(16)
      .setVisible(false);
    this.bossBarTrackSecondary = this.add
      .rectangle(GAME_WIDTH * 0.5, 118, 430, 10, 0x020408, 0.9)
      .setDepth(16)
      .setVisible(false);
    this.bossBarFillSecondary = this.add
      .rectangle(GAME_WIDTH * 0.5 - 215, 118, 430, 6, 0xff7f3a, 1)
      .setOrigin(0, 0.5)
      .setDepth(17)
      .setVisible(false);

    this.objectiveText = this.add
      .text(16, GAME_HEIGHT - 108, '', {
        fontSize: '16px',
        fontStyle: '700',
        color: palette.accent.warmText,
        backgroundColor: this.hudCss.hudPanel,
        padding: { x: 8, y: 5 }
      })
      .setDepth(12)
      .setVisible(false);
    this.hintText = this.add
      .text(16, GAME_HEIGHT - 76, '', {
        fontSize: '13px',
        fontStyle: '700',
        color: this.hudCss.systemText,
        backgroundColor: '#020408cc',
        padding: { x: 8, y: 5 },
        wordWrap: { width: 380 }
      })
      .setDepth(12)
      .setVisible(false);
    this.instructionText = this.add
      .text(16, GAME_HEIGHT - 44, `${buildRaycastMinimapLegendLine()}  |  H/? HELP`, {
        fontSize: '11px',
        color: this.hudCss.debugText,
        backgroundColor: '#020408c8',
        padding: { x: 8, y: 5 }
      })
      .setAlpha(0.82)
      .setDepth(11)
      .setVisible(false);
    this.minimapFrame = this.add
      .rectangle(
        hudLayout.minimapFrameX,
        hudLayout.minimapFrameY,
        hudLayout.minimapFrameWidth,
        hudLayout.minimapFrameHeight,
        0x020408,
        0.76
      )
      .setStrokeStyle(2, ionHudAccent, 0.55)
      .setDepth(11);
    this.minimapTitleText = this.add
      .text(hudLayout.minimapTitleX, hudLayout.minimapTitleY, 'MINIMAPA M', {
        fontSize: '12px',
        fontStyle: '700',
        color: this.hudCss.accentText,
        backgroundColor: '#020408cc',
        padding: { x: 6, y: 4 }
      })
      .setOrigin(0.5)
      .setDepth(12);
    this.helpOverlayFrame = this.add
      .rectangle(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.53, 428, 250, 0x020408, 0.92)
      .setStrokeStyle(2, ionHudAccent, 0.6)
      .setDepth(24)
      .setVisible(false);
    this.helpOverlayTitleText = this.add
      .text(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.34, 'AYUDA RÁPIDA RAYCAST', {
        fontSize: '18px',
        fontStyle: '700',
        color: this.hudCss.accentText,
        backgroundColor: '#020408cc',
        padding: { x: 8, y: 4 }
      })
      .setOrigin(0.5)
      .setDepth(25)
      .setVisible(false);
    this.helpOverlayText = this.add
      .text(
        GAME_WIDTH * 0.5,
        GAME_HEIGHT * 0.55,
        buildRaycastHelpOverlayText({
          difficultyLabel: difficultyPreset.label,
          difficultySummary: difficultyPreset.inGameSummary
        }),
        {
          fontSize: '14px',
          fontStyle: '700',
          color: '#f4f7d0',
          align: 'left',
          lineSpacing: 4,
          wordWrap: { width: 360 }
        }
      )
      .setOrigin(0.5)
      .setDepth(25)
      .setVisible(false);
    this.minimapGraphics = this.add.graphics().setDepth(12);
    this.minimapMarkerLabels = Array.from({ length: 8 }, () =>
      this.add
        .text(0, 0, '', {
          fontFamily: 'monospace',
          fontSize: '8px',
          fontStyle: '700',
          color: '#f4f7d0',
          stroke: '#020408',
          strokeThickness: 2
        })
        .setDepth(13)
        .setVisible(false)
    );

    this.muzzleFlash = this.add.rectangle(GAME_WIDTH * 0.5, this.muzzleFlashAnchorY, 96, 34, palette.accent.projectile, 0);
    this.muzzleFlash.setDepth(11);
    this.wallImpactFlash = this.add.circle(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, 18, 0xffffff, 0);
    this.wallImpactFlash.setDepth(12);
    this.damageFlash = this.add.rectangle(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT, RAYCAST_ATMOSPHERE.damageFlash, 0);
    this.damageFlash.setDepth(13);
    this.damageFrameTop = this.add.rectangle(GAME_WIDTH * 0.5, 10, GAME_WIDTH, 20, 0xff5b6f, 0).setDepth(14);
    this.damageFrameBottom = this.add
      .rectangle(GAME_WIDTH * 0.5, GAME_HEIGHT - 10, GAME_WIDTH, 20, 0xff5b6f, 0)
      .setDepth(14);
    this.damageFrameLeft = this.add.rectangle(10, GAME_HEIGHT * 0.5, 20, GAME_HEIGHT, 0xff5b6f, 0).setDepth(14);
    this.damageFrameRight = this.add
      .rectangle(GAME_WIDTH - 10, GAME_HEIGHT * 0.5, 20, GAME_HEIGHT, 0xff5b6f, 0)
      .setDepth(14);
    this.feedbackPulse = this.add.rectangle(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT, RAYCAST_PALETTE.plasmaBright, 0);
    this.feedbackPulse.setDepth(11);
    this.corruptionVeil = this.add.rectangle(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT, RAYCAST_ATMOSPHERE.corruptionTint, 0);
    this.corruptionVeil.setDepth(9);
    this.pickupToastLayout = buildRaycastPickupToastLayout(GAME_WIDTH, hudLayout);
    this.pickupToastText = this.add
      .text(this.pickupToastLayout.x, this.pickupToastLayout.y, '', {
        fontSize: '12px',
        fontStyle: '700',
        color: '#edf7f3',
        backgroundColor: '#020408b8',
        padding: { x: 10, y: 5 },
        align: 'center',
        wordWrap: { width: this.pickupToastLayout.maxWidth }
      })
      .setOrigin(0.5, 0)
      .setDepth(13)
      .setAlpha(0)
      .setVisible(false);
    this.systemText = this.add
      .text(GAME_WIDTH * 0.5, 58, getRaycastIntroMessageForSegment(this.getWorldSegment()), {
        fontSize: '20px',
        fontStyle: '700',
        color: this.hudCss.systemText,
        stroke: '#020408',
        strokeThickness: 5,
        wordWrap: { width: GAME_WIDTH - 96 }
      })
      .setOrigin(0.5)
      .setDepth(14);
    this.hitMarker = this.add
      .text(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, 'x', {
        fontSize: '34px',
        fontStyle: '700',
        color: '#ffffff',
        stroke: '#05070c',
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(15)
      .setAlpha(0);

    this.finalOverlay = this.add.rectangle(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT, 0x020408, 0.82);
    this.finalOverlay.setDepth(30).setVisible(false);
    this.finalTitleText = this.add
      .text(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.3, '', {
        fontSize: '28px',
        fontStyle: '700',
        color: this.hudCss.warningText,
        stroke: '#020408',
        strokeThickness: 6
      })
      .setOrigin(0.5)
      .setDepth(31)
      .setVisible(false);
    this.finalSummaryText = this.add
      .text(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, '', {
        fontSize: '13px',
        fontStyle: '700',
        color: this.hudCss.systemText,
        align: 'center',
        lineSpacing: 8
      })
      .setOrigin(0.5)
      .setDepth(31)
      .setVisible(false);
    this.finalHintText = this.add
      .text(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.73, 'T REINICIAR NIVEL  |  ESC MENÚ', {
        fontSize: '12px',
        fontStyle: '700',
        color: this.hudCss.keyText,
        stroke: '#020408',
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(31)
      .setVisible(false);

    this.pauseDim = this.add
      .rectangle(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT, 0x020408, 0.52)
      .setDepth(40)
      .setVisible(false);
    const pauseLayout = computeRaycastPausePanelLayout(this.scale.width, this.scale.height);
    this.pausePanel = this.add
      .rectangle(pauseLayout.centerX, pauseLayout.centerY, pauseLayout.panelWidth, pauseLayout.panelHeight, 0x050810, 0.93)
      .setStrokeStyle(1, 0x334858, 0.72)
      .setDepth(41)
      .setVisible(false);
    this.pauseTitleText = this.add
      .text(pauseLayout.centerX, pauseLayout.titleY, 'SISTEMA EN PAUSA', {
        fontFamily: 'monospace',
        fontSize: '20px',
        fontStyle: '700',
        color: this.hudCss.systemText,
        stroke: '#020408',
        strokeThickness: 5
      })
      .setOrigin(0.5, 0)
      .setDepth(42)
      .setVisible(false);
    this.pauseMenuBodyText = this.add
      .text(pauseLayout.centerX - pauseLayout.bodyWrapWidth * 0.5, pauseLayout.bodyY, '', {
        fontFamily: 'monospace',
        fontSize: pauseLayout.fontSize,
        fontStyle: '700',
        color: this.hudCss.keyText,
        align: 'left',
        lineSpacing: pauseLayout.lineSpacing,
        wordWrap: { width: pauseLayout.bodyWrapWidth }
      })
      .setOrigin(0, 0)
      .setDepth(42)
      .setVisible(false);

    this.debugText = this.add
      .text(16, GAME_HEIGHT - 38, '', {
        fontSize: '12px',
        color: this.hudCss.debugText,
        backgroundColor: this.hudCss.hudPanel,
        padding: { x: 8, y: 5 }
      })
      .setAlpha(0.68)
      .setVisible(false)
      .setDepth(10);

    this.perfText = this.add
      .text(12, 12, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: this.hudCss.debugText,
        backgroundColor: '#020408cc',
        padding: { x: 8, y: 6 },
        lineSpacing: 3
      })
      .setDepth(19)
      .setVisible(false);

    stopGameMasterVoice('scene_start');
    const narrationHudLayout = buildRaycastHudLayout(GAME_WIDTH, GAME_HEIGHT);
    this.narrationOverlay = new RaycastNarrationOverlay(
      this,
      buildRaycastNarrationLayoutFromHud(narrationHudLayout),
      this.hudCss,
      { displayMs: getGameMasterNarrationDurationMs(this.registry) },
      { debug: getGameMasterNarrationDebug(this.registry) },
    );
    this.gameMasterNarration = new GameMasterNarrationBridge(
      (message, source, tier) => this.deliverGameMasterNarration(message, source, tier),
      { debug: getGameMasterNarrationDebug(this.registry) },
    );
    if (this.currentLevel.bossConfig) {
      this.requestBossSpawnGameMasterNarration();
    }

    this.sceneReady = true;
    this.cameras.main.fadeIn(460, 0, 0, 0);
    const modifierIntro = this.runModifier ? ` // MOD ${this.runModifier.label}` : '';
    this.setCombatMessage(`${this.activeLevelEvent.introText}${modifierIntro} // ${this.buildLevelStartObjectiveMessage()}`, 4700);
    this.registerInputListeners();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupSceneLifecycle, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupSceneLifecycle, this);
  }

  update(_time: number, delta: number): void {
    const frameStartMs = performance.now();
    let renderMs = 0;

    this.pollGamepadInput();
    this.pollTouchInput();
    if (!this.gamePaused) {
      this.updatePickupToast();
      this.updateNarrationOverlay();
    }
    this.combat?.tick(this.time.now);
    const deltaMs = Math.min(Math.max(0, delta), 50);
    const deltaSeconds = deltaMs / 1000;
    const weapon = this.combat.getCurrentWeapon();
    const reloadBlend = this.combat.getReloadBlend(this.time.now);
    const moving = Math.hypot(this.player.velocity.x, this.player.velocity.y) > 0.05;
    tickCombatFeelRuntime(this.combatFeelState, this.time.now, deltaSeconds, moving, weapon, reloadBlend);
    const frozen = shouldSkipGameplayDuringFreeze(this.time.now, this.freezeFrameUntil);
    const bossIntroActive = this.bossIntroUntil > this.time.now;
    if (this.playerAlive && !this.levelComplete && !this.gamePaused && !frozen && !bossIntroActive) {
      this.controller.update(deltaMs);
      this.updatePlayerMetrics(deltaMs);
      this.updateLevelState();
      // In co-op the server runs the enemy AI and director — skip local simulation.
      if (!this.netConnected) {
        this.updateEnemies(deltaMs);
        this.updateGameDirector();
      }
      this.updateAtmospherePulse();
      this.updateCorruptionSurge();
      this.updateBlackoutPulse();
      this.updateBossArenaHazards();
      this.applyPassiveHeal(deltaMs);
      // Co-op: send player position to server at ~20 Hz (server tick rate).
      if (this.netConnected && this.netClient) {
        this.netInputThrottle += deltaMs;
        if (this.netInputThrottle >= TICK_INTERVAL_MS) {
          this.netInputThrottle -= TICK_INTERVAL_MS;
          this.netClient.sendInput(this.player.x, this.player.y, this.player.angle, []);
        }
      }
    }
    const atmosphere = this.getAtmosphereOptions();
    const viewKick = this.combatFeelState.cameraKickRad;
    const renderPlayer =
      viewKick > 0.0002 ? { ...this.player, angle: this.player.angle + viewKick } : this.player;
    const renderStartMs = performance.now();
    this.raycastRenderer.render(renderPlayer, GAME_WIDTH, GAME_HEIGHT, atmosphere);
    renderMs += performance.now() - renderStartMs;
    this.refreshBillboardCache();
    const billboardsStartMs = performance.now();
    const allBillboards = this.netConnected && this.netState
      ? [...this.cachedBillboards, ...this.buildRemotePlayerBillboards()]
      : this.cachedBillboards;
    this.raycastRenderer.renderBillboards(this.player, allBillboards, GAME_WIDTH, GAME_HEIGHT);
    renderMs += performance.now() - billboardsStartMs;
    const spritesStartMs = performance.now();
    this.raycastRenderer.renderEnemies(this.player, this.enemies, GAME_WIDTH, GAME_HEIGHT, this.time.now, atmosphere);
    this.bossStates.forEach((boss) => {
      this.raycastRenderer.renderBoss(this.player, boss, GAME_WIDTH, GAME_HEIGHT, this.time.now, atmosphere);
    });
    this.raycastRenderer.renderEnemyProjectiles(this.player, this.enemyProjectiles, GAME_WIDTH, GAME_HEIGHT);
    renderMs += performance.now() - spritesStartMs;
    const muzzleAlpha = this.getWeaponOverlayFlashAlpha();
    const weaponStartMs = performance.now();
    this.raycastRenderer.renderWeaponOverlay(
      weapon,
      GAME_WIDTH,
      GAME_HEIGHT,
      muzzleAlpha,
      buildWeaponViewFeel(this.combatFeelState, weapon, this.time.now, moving, reloadBlend, muzzleAlpha)
    );
    renderMs += performance.now() - weaponStartMs;
    this.corruptionVeil.setAlpha(this.time.now < this.blackoutPulseUntil ? Math.max(0.28, atmosphere.corruptionAlpha) : atmosphere.corruptionAlpha);
    const objectiveState = this.getObjectiveState();
    const objective = buildRaycastCurrentObjective(objectiveState);
    const objectiveHudBase = formatRaycastObjectiveHudLabel(objective, this.currentLevel.hudObjectiveLabels);
    const hintBase = buildRaycastHintText(objectiveState);
    this.getEventAwareObjectiveText(objectiveHudBase);
    const hint = this.getEventAwareHintText(hintBase);
    const preset = getRaycastDifficultyPreset(this.difficultyId);
    const ammoState = this.combat.getAmmoState();
    let statusLine = buildRaycastHudStatusLine(
      this.playerHealth,
      this.playerMaxHealth,
      this.combat.getWeaponLabel(),
      preset.shortLabel,
      {
        current: ammoState.current,
        capacity: ammoState.capacity,
        reloading: this.combat.isReloading(this.time.now)
      }
    );
    if (this.passiveRegenHudActive) {
      statusLine += `  |  ${this.passiveRegenHudLabel ?? 'REGEN'}`;
    } else if (this.passiveRegenHudLabel) {
      statusLine += `  |  ${this.passiveRegenHudLabel}`;
    }
    this.healthText.setText(statusLine);
    this.weaponText.setText(
      buildRaycastHudProgressLine(
        this.getKeyCount(),
        this.currentLevel.keys.length,
        this.collectedSecrets.size,
        this.currentLevel.secrets.length
      )
    );
    const blinded = this.time.now < this.flashBlindUntil;
    const hudAlpha = blinded ? 0.55 : 1;
    this.healthText.setAlpha(hudAlpha);
    this.weaponText.setAlpha(hudAlpha);
    this.updateHealthHud();
    this.updateBossHud();
    this.targetText.setVisible(false);
    this.targetBarTrack.setVisible(false);
    this.targetBarFill.setVisible(false);
    this.updatePriorityMessage(objective, hint, objectiveState.recentBlockedReason !== undefined && objectiveState.recentBlockedReason !== null);
    const frameMsNow = performance.now() - frameStartMs;
    const fpsNow = frameMsNow > 0 ? 1000 / frameMsNow : this.frameStats.fps;
    const fpsTarget = getFpsTarget(this.registry);
    this.adaptiveQuality = updateAdaptiveMinimapStrideBoost(
      this.adaptiveQuality,
      fpsNow,
      fpsTarget === 0 ? 120 : fpsTarget,
    );
    this.renderMinimapThrottled();
    if (this.debugHudVisible) {
      this.debugText.setText(
        buildRaycastDebugLine({
          position: `${this.player.x.toFixed(1)},${this.player.y.toFixed(1)}`,
          directorLine: this.getDirectorDebugLine(),
          message: this.getCurrentStatusMessage(),
          gameMasterLine: this.buildDebugHudExtrasLine(),
        })
      );
    }
    if (this.perfHudVisible) {
      const perfSample = {
        frameMs: performance.now() - frameStartMs,
        renderMs,
        enemies: this.countLivingEnemies(),
        projectiles: this.enemyProjectiles.length,
        gmInFlight: this.gameMasterNarration?.isNarrationInFlight() ?? false,
        gmNarrationEnabled: getGameMasterNarrationEnabled(this.registry),
        gmVoiceEnabled: getGameMasterVoiceEnabled(this.registry),
        fpsTarget: getFpsTarget(this.registry),
        renderQualityLabel: formatRenderQualityLabel(getRenderQuality(this.registry)),
        gmStatusLine: this.buildGameMasterHudStatusLine(),
        gmSource: this.perfHudVisible ? this.lastGmSource : null,
      };
      this.frameStats = recordRaycastFrameSample(this.frameStats, perfSample);
      this.perfText.setText(formatRaycastPerfHudLine(this.frameStats, perfSample));
    }
    if (this.gamePaused) {
      const resolved = this.resolveSceneActiveInput();
      if (resolved !== this.detectedActiveInputKind) {
        this.detectedActiveInputKind = resolved;
        this.refreshPauseMenuBody();
      }
    }
  }

  private pollGamepadInput(): void {
    if (!this.gamepadInput) return;
    this.gamepadInput.update();
    const message = this.gamepadInput.consumeStatusMessage();
    if (message) {
      this.controller?.suppressLookInput(2);
      this.setCombatMessage(message, 1600);
    }

    if (this.gamepadInput.consumePressed('toggleMap')) {
      this.handleToggleMinimap();
    }

    if (this.gamepadInput.consumePressed('pause')) {
      this.handleEscKey();
    }

    if (this.gamepadInput.consumePressed('cancel')) {
      if (this.gamePaused) {
        if (this.pausePanelMode === 'control') this.closeControlSettingsPanel();
        else if (this.pausePanelMode === 'settings') this.closeSettingsPanel();
        else this.closePauseMenu();
      }
      else this.handleEscKey();
    }

    if (this.gamepadInput.consumePressed('confirm')) {
      if (this.gamePaused) {
        this.handlePauseMenuConfirm();
      } else if (this.levelComplete) {
        if (!this.episodeComplete && this.nextLevelId !== null) this.handleAdvanceLevel();
        else this.restartCurrentLevel();
      }
    }

    if (!this.gamePaused) {
      if (this.gamepadInput.consumePressed('reload')) {
        this.handleRetry();
      }

      if (this.gamepadInput.consumePressed('fire')) {
        this.handleFireInput();
      }

      if (this.gamepadInput.consumePressed('nextWeapon')) {
        this.cycleWeapon(1);
      }

      if (this.gamepadInput.consumePressed('previousWeapon')) {
        this.cycleWeapon(-1);
      }
    }

    if (this.gamepadInput.consumePressed('navUp')) {
      this.handlePauseMenuUp();
    }

    if (this.gamepadInput.consumePressed('navDown')) {
      this.handlePauseMenuDown();
    }

    if (this.gamepadInput.consumePressed('navLeft')) {
      this.handlePauseMenuLeft();
    }

    if (this.gamepadInput.consumePressed('navRight')) {
      this.handlePauseMenuRight();
    }

    if (
      this.gamepadInput.consumePressed('navUp') ||
      this.gamepadInput.consumePressed('navDown') ||
      this.gamepadInput.consumePressed('navLeft') ||
      this.gamepadInput.consumePressed('navRight') ||
      this.gamepadInput.consumePressed('confirm') ||
      this.gamepadInput.consumePressed('cancel') ||
      this.gamepadInput.consumePressed('pause')
    ) {
      this.markDetectedActiveInput('gamepad');
    }
    this.trackConnectedInputActivity();
  }

  private pollTouchInput(): void {
    if (!this.touchInput) return;
    this.touchInput.update();
    const touchMessage = this.touchInput.consumeStatusMessage();
    if (touchMessage) {
      this.setCombatMessage(touchMessage, 1400);
      this.controller?.suppressLookInput(2);
    }

    if (this.touchInput.consumePressed('toggleMap')) this.handleToggleMinimap();
    if (this.touchInput.consumePressed('pause')) this.handleEscKey();
    if (this.touchInput.consumePressed('cancel')) {
      if (this.gamePaused) {
        if (this.pausePanelMode === 'control') this.closeControlSettingsPanel();
        else if (this.pausePanelMode === 'settings') this.closeSettingsPanel();
        else this.closePauseMenu();
      } else {
        this.handleEscKey();
      }
    }

    if (this.touchInput.consumePressed('confirm')) {
      if (this.gamePaused) {
        this.handlePauseMenuConfirm();
      } else if (this.levelComplete) {
        if (!this.episodeComplete && this.nextLevelId !== null) this.handleAdvanceLevel();
        else this.restartCurrentLevel();
      }
    }

    if (!this.gamePaused) {
      if (this.touchInput.consumePressed('reload')) this.handleRetry();
      if (this.touchInput.consumePressed('fire')) this.handleFireInput();
      if (this.touchInput.consumePressed('weapon1')) this.handleWeaponSlotOne();
      if (this.touchInput.consumePressed('weapon2')) this.handleWeaponSlotTwo();
      if (this.touchInput.consumePressed('weapon3')) this.handleWeaponSlotThree();
      if (this.touchInput.consumePressed('nextWeapon')) this.cycleWeapon(1);
      if (this.touchInput.consumePressed('previousWeapon')) this.cycleWeapon(-1);
    }
    if (this.touchInput.consumePressed('navUp')) this.handlePauseMenuUp();
    if (this.touchInput.consumePressed('navDown')) this.handlePauseMenuDown();
    if (this.touchInput.consumePressed('navLeft')) this.handlePauseMenuLeft();
    if (this.touchInput.consumePressed('navRight')) this.handlePauseMenuRight();
    if (
      this.touchInput.consumePressed('navUp') ||
      this.touchInput.consumePressed('navDown') ||
      this.touchInput.consumePressed('navLeft') ||
      this.touchInput.consumePressed('navRight') ||
      this.touchInput.consumePressed('confirm') ||
      this.touchInput.consumePressed('cancel') ||
      this.touchInput.consumePressed('pause')
    ) {
      this.markDetectedActiveInput('touch');
    }
    this.trackConnectedInputActivity();
  }

  private resetRuntimeState(): void {
    this.player = {
      x: this.currentLevel.playerStart.x,
      y: this.currentLevel.playerStart.y,
      angle: this.currentLevel.playerStart.angle,
      velocity: { ...this.currentLevel.playerStart.velocity }
    };
    this.playerMaxHealth = this.getBasePlayerMaxHealth();
    this.playerHealth = this.playerMaxHealth;
    this.damageTaken = 0;
    this.runStartedAt = this.time.now;
    this.playerAlive = true;
    this.levelComplete = false;
    this.episodeComplete = false;
    this.collectedSecrets.clear();
    this.collectedHealthPickups.clear();
    this.deferredPickupHints.clear();
    this.pickupToastQueue = createRaycastPickupToastQueue();
    this.completedEncounterBeats.clear();
    this.enemiesKilled = 0;
    this.runPelletsFired = 0;
    this.runPelletsHitHostile = 0;
    this.runBossPelletsFired = 0;
    this.runBossPelletsHitHostile = 0;
    this.runBossDamageTaken = 0;
    this.runScore = this.carriedScoreFromEpisode;
    if (this.pendingWorldTwoBreachBonus) {
      this.runScore += RAYCAST_WORLD2_ENTRY_POINTS;
      this.pendingWorldTwoBreachBonus = false;
    }
    if (this.pendingWorldThreeBreachBonus) {
      this.runScore += RAYCAST_WORLD3_ENTRY_POINTS;
      this.pendingWorldThreeBreachBonus = false;
    }
    this.levelStartScore = this.runScore;
    this.levelStartCampaignMetrics = { ...this.campaignMetrics };
    this.carriedScoreFromEpisode = 0;
    this.playerStationaryMs = 0;
    this.lastPlayerDamageAt = this.time.now;
    this.lastPlayerPosition.x = this.currentLevel.playerStart.x;
    this.lastPlayerPosition.y = this.currentLevel.playerStart.y;
    this.activeZoneId = null;
    this.directorDebug = null;
    this.lastDirectorState = null;
    this.directorIntensity = 0;
    this.directorSpawnCounter = 0;
    this.encounterPatternCooldownUntil.clear();
    this.debugHudVisible = false;
    this.minimapVisible = getMinimapDefaultVisible(this.registry);
    this.helpOverlayVisible = false;
    this.enemyProjectiles = [];
    this.lastCombatMessage = getRaycastIntroMessageForSegment(this.getWorldSegment());
    this.combatMessageUntil = 0;
    this.blockedHintReason = null;
    this.blockedHintUntil = 0;
    this.lastLowHealthWarningAt = null;
    this.weaponOverlayFlashUntil = 0;
    this.combatFeelState = createCombatFeelRuntimeState();
    this.freezeFrameUntil = 0;
    this.nextAmbientCueAt = 0;
    const eventRng = createSeededLevelEventRng(`${this.currentLevel.id}:${Math.floor(this.time.now)}`);
    this.activeLevelEvent = selectRaycastLevelEvent({
      isBossLevel: Boolean(this.currentLevel.bossConfig),
      rng: eventRng
    });
    this.hudObjectiveJamText = null;
    this.hudHintJamText = null;
    this.nextHudJamAt = 0;
    this.nextCorruptionZoneAt = this.time.now + 5000;
    this.corruptionZone = null;
    this.blackoutPulseUntil = 0;
    this.flashBlindUntil = 0;
    this.nextBossAddSpawnAt = this.time.now + 4200;
    this.sceneReady = false;
    this.gamePaused = false;
    this.pauseSelectionIndex = 0;
    this.passiveRegenHudActive = false;
    this.passiveRegenHudLabel = null;
    this.passiveHealFractionalCarry = 0;
    this.runUsedPassiveRegen = false;
    this.runClearedLevelIds.clear();
    this.runRankByLevelId.clear();
    this.bossHazards = this.currentLevel.bossConfig ? createRaycastBossHazardState(this.currentLevel.id) : null;
    this.billboardSig = '';
    this.cachedBillboards = [];
    this.minimapFrameCounter = 0;
    this.mapLayoutRevision = 0;
    this.minimapStaticCellsCacheKey = '';
    this.minimapStaticCells = null;
    this.bossTelegraphById.clear();
    this.lastBossPhaseById.clear();
    this.bossStates = [];
    const arenaOpts = { arenaLevelId: this.currentLevel.id };
    if (this.currentLevel.bossConfig) {
      const primary = createRaycastBossState(this.currentLevel.bossConfig, this.time.now, arenaOpts);
      this.bossStates.push(primary);
      this.lastBossPhaseById.set(primary.id, primary.phase);
      const behavior = this.currentLevel.bossConfig.behavior ?? 'volt-archon';
      const intro = getBossIntroCopy(this.currentLevel.bossConfig.displayName, behavior);
      this.bossIntroUntil = this.time.now + BOSS_INTRO_DURATION_MS;
      this.setCombatMessage(`${intro.title} // ${intro.subtitle}`, BOSS_INTRO_DURATION_MS);
      this.audioFeedback.play('bossPhaseShift', 0.72, this.time.now);
      this.cameras.main.setZoom(1.07);
      this.tweens.add({
        targets: this.cameras.main,
        zoom: 1,
        duration: BOSS_INTRO_DURATION_MS,
        ease: 'Cubic.easeOut'
      });
    } else {
      this.bossIntroUntil = 0;
    }
    if (this.currentLevel.id === 'ash-judge-seal') {
      const twin = createRaycastBossState(
        { id: 'ash-judge-twin', displayName: 'Ash Judge Prime', x: 9.8, y: 7.1, maxHealth: 920, hitRadius: 0.75, behavior: 'ash-judge' },
        this.time.now,
        arenaOpts,
      );
      this.bossStates.push(twin);
      this.lastBossPhaseById.set(twin.id, twin.phase);
    }
  }

  private registerInputListeners(): void {
    if (this.inputListenersRegistered) this.cleanupInputListeners();
    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-ESC', this.handleEscKey);
    keyboard?.on('keydown-R', this.handleRetry);
    keyboard?.on('keydown-T', this.handleRestartLevel);
    keyboard?.on('keydown-N', this.handleAdvanceLevel);
    keyboard?.on('keydown-W', this.handleWorldTwoPlaceholder);
    keyboard?.on('keydown-F', this.handleFireInput);
    keyboard?.on('keydown-SPACE', this.handleFireInput);
    keyboard?.on('keydown-ONE', this.handleWeaponSlotOne);
    keyboard?.on('keydown-TWO', this.handleWeaponSlotTwo);
    keyboard?.on('keydown-THREE', this.handleWeaponSlotThree);
    keyboard?.on('keydown-M', this.handleToggleMinimap);
    keyboard?.on('keydown-H', this.handleToggleHelp);
    keyboard?.on('keydown-SLASH', this.handleHelpShortcut);
    if (DEV_SHORTCUT_ENABLED) {
      keyboard?.on('keydown', this.handleDevBossShortcut);
      keyboard?.on('keydown-J', this.handleDevShiftJ);
    }
    keyboard?.on('keydown-FOUR', this.handleBossShortcutOne);
    keyboard?.on('keydown-FIVE', this.handleBossShortcutTwo);
    keyboard?.on('keydown-SIX', this.handleBossShortcutThree);
    keyboard?.on('keydown-TAB', this.handleToggleDebug);
    keyboard?.on('keydown-BACKTICK', this.handleToggleDebug);
    keyboard?.on('keydown-F3', this.handleToggleDebug);
    keyboard?.on('keydown-P', this.handleTogglePerfHud);
    keyboard?.on('keydown-G', this.handleGameMasterTestKey);
    keyboard?.on('keydown-L', this.handleObjectiveReminderKey);
    keyboard?.on('keydown-UP', this.handlePauseMenuUp);
    keyboard?.on('keydown-DOWN', this.handlePauseMenuDown);
    keyboard?.on('keydown-LEFT', this.handlePauseMenuLeft);
    keyboard?.on('keydown-RIGHT', this.handlePauseMenuRight);
    keyboard?.on('keydown-ENTER', this.handlePauseMenuConfirm);
    this.input.on('pointerdown', this.handleFireInput);
    this.input.on('wheel', this.handlePauseMenuWheel);
    this.input.on('pointerdown', this.handlePauseMenuPointerDown);
    this.inputListenersRegistered = true;
  }

  private registerNetHandlers(): void {
    if (!this.netClient || !this.netState) return;

    this.netClient.on<SnapshotMessage>('snapshot', (snap) => {
      if (!this.netState) return;
      this.netState.applySnapshot(snap);
      this.syncEnemiesFromSnapshot(snap.enemies);
      this.syncLevelStateFromSnapshot(snap);
      const local = this.netState.getLocalPlayer();
      if (local) {
        this.playerHealth = local.hp;
        if (!local.alive) {
          this.playerAlive = false;
        } else if (!this.playerAlive && local.alive) {
          // Server respawned us — restore position and mark alive.
          this.playerAlive = true;
          this.playerHealth = local.hp;
          this.player.x = local.x;
          this.player.y = local.y;
          this.player.angle = local.yaw;
        }
      }
    });

    this.netClient.on<{ type: string; kind: string; nextLevelId?: string }>('event', (ev) => {
      if (ev.kind === 'gameOver') {
        // All players down — show overlay directly without showRunCompleteOverlay()
        // so we don't contaminate telemetry/save data with co-op game-over state.
        this.playerAlive = false;
        this.finalOverlay?.setVisible(true).setAlpha(0.9);
        this.finalTitleText?.setText('GAME OVER').setColor('#cc2222').setVisible(true);
        this.finalSummaryText?.setText('Todos los jugadores han caído.').setVisible(true);
        this.finalHintText?.setText('ESC → MENÚ').setVisible(true);
      } else if (ev.kind === 'levelChange' && ev.nextLevelId) {
        // Server advanced all players to the next level.
        // Park the live WebSocket in the registry so the new scene instance can reuse it.
        this.registry.set('coopNetClient', this.netClient);
        this.registry.set('coopNetState', this.netState);
        this.netTransitioning = true;
        this.stopGameMasterPresentation('level_transition');
        this.scene.restart({
          levelId: ev.nextLevelId,
          netMode: true,
          serverUrl: this.netServerUrl ?? undefined,
          playerName: this.netPlayerName ?? 'Player',
          difficultyId: this.difficultyId,
          carryScore: this.runScore,
          carryCampaignMetrics: this.campaignMetrics,
          rewardTier: this.rewardTier,
          runModifierId: this.runModifier?.id ?? null,
        });
      }
    });
  }

  private cleanupSceneLifecycle(): void {
    this.stopGameMasterPresentation('scene_shutdown');
    if (this.netTransitioning) {
      // Level transition: the live WebSocket is already saved in the registry.
      // Drop old handlers (they close over the old scene's 'this') without closing the socket.
      this.netClient?.clearListeners();
    } else {
      // Normal exit (menu, restart): close the socket.
      this.netClient?.disconnect();
    }
    this.netClient = null;
    this.netState = null;
    this.netConnected = false;
    this.netTransitioning = false;
    if (!this.sceneReady && !this.inputListenersRegistered) return;
    this.sceneReady = false;
    this.gamepadInput?.destroy();
    this.touchInput?.destroy();
    this.controller?.destroy();
    this.cleanupInputListeners();
    this.killUiTweens();
  }

  private cleanupInputListeners(): void {
    if (!this.inputListenersRegistered) return;
    const keyboard = this.input.keyboard;
    keyboard?.off('keydown-ESC', this.handleEscKey);
    keyboard?.off('keydown-R', this.handleRetry);
    keyboard?.off('keydown-T', this.handleRestartLevel);
    keyboard?.off('keydown-N', this.handleAdvanceLevel);
    keyboard?.off('keydown-W', this.handleWorldTwoPlaceholder);
    keyboard?.off('keydown-F', this.handleFireInput);
    keyboard?.off('keydown-SPACE', this.handleFireInput);
    keyboard?.off('keydown-ONE', this.handleWeaponSlotOne);
    keyboard?.off('keydown-TWO', this.handleWeaponSlotTwo);
    keyboard?.off('keydown-THREE', this.handleWeaponSlotThree);
    keyboard?.off('keydown-M', this.handleToggleMinimap);
    keyboard?.off('keydown-H', this.handleToggleHelp);
    keyboard?.off('keydown-SLASH', this.handleHelpShortcut);
    if (DEV_SHORTCUT_ENABLED) {
      keyboard?.off('keydown', this.handleDevBossShortcut);
      keyboard?.off('keydown-J', this.handleDevShiftJ);
    }
    keyboard?.off('keydown-FOUR', this.handleBossShortcutOne);
    keyboard?.off('keydown-FIVE', this.handleBossShortcutTwo);
    keyboard?.off('keydown-SIX', this.handleBossShortcutThree);
    keyboard?.off('keydown-TAB', this.handleToggleDebug);
    keyboard?.off('keydown-BACKTICK', this.handleToggleDebug);
    keyboard?.off('keydown-F3', this.handleToggleDebug);
    keyboard?.off('keydown-P', this.handleTogglePerfHud);
    keyboard?.off('keydown-G', this.handleGameMasterTestKey);
    keyboard?.off('keydown-L', this.handleObjectiveReminderKey);
    keyboard?.off('keydown-UP', this.handlePauseMenuUp);
    keyboard?.off('keydown-DOWN', this.handlePauseMenuDown);
    keyboard?.off('keydown-LEFT', this.handlePauseMenuLeft);
    keyboard?.off('keydown-RIGHT', this.handlePauseMenuRight);
    keyboard?.off('keydown-ENTER', this.handlePauseMenuConfirm);
    this.input.off('pointerdown', this.handleFireInput);
    this.input.off('wheel', this.handlePauseMenuWheel);
    this.input.off('pointerdown', this.handlePauseMenuPointerDown);
    this.inputListenersRegistered = false;
  }

  private killUiTweens(): void {
    const tweenTargets = [
      this.muzzleFlash,
      this.wallImpactFlash,
      this.damageFlash,
      this.damageFrameTop,
      this.damageFrameBottom,
      this.damageFrameLeft,
      this.damageFrameRight,
      this.feedbackPulse,
      this.corruptionVeil,
      this.systemText,
      this.crosshair,
      this.hitMarker,
      this.finalOverlay,
      this.finalTitleText,
      this.finalSummaryText,
      this.finalHintText
    ].filter((target): target is Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc | Phaser.GameObjects.Text => target !== undefined);
    if (tweenTargets.length > 0) this.tweens.killTweensOf(tweenTargets);
  }

  private canHandleRaycastInput(): boolean {
    return (
      this.sceneReady &&
      !this.gamePaused &&
      this.isRaycastSceneActive() &&
      this.combat !== undefined &&
      this.audioFeedback !== undefined
    );
  }

  private isRaycastSceneActive(): boolean {
    return this.scene.isActive('RaycastScene');
  }

  private getLiveBosses(): RaycastBossState[] {
    return this.bossStates.filter((boss) => boss.alive);
  }

  private getRewardDamageMultiplier(): number {
    return 1 + this.rewardTier * REWARD_DAMAGE_STEP;
  }

  private applyEventScoreGain(scoreGain: number): number {
    const eventAdjusted = applyRaycastEventScoreMultiplier(scoreGain, this.activeLevelEvent);
    return applyRunModifierScore(eventAdjusted, this.runModifier);
  }

  private getPlayerDamageMultiplier(): number {
    return (
      this.getRewardDamageMultiplier() *
      (this.activeLevelEvent.effects.playerDamageMultiplier ?? 1) *
      (this.runModifier?.effects.playerDamageMul ?? 1)
    );
  }

  private getBasePlayerMaxHealth(): number {
    const base = BASE_PLAYER_MAX_HEALTH * Math.pow(REWARD_HEALTH_STEP, this.rewardTier);
    return Math.max(30, Math.round(base * (this.runModifier?.effects.playerMaxHealthMul ?? 1)));
  }

  private buildLevelEnemiesForEvent(): RaycastEnemy[] {
    const baseEnemies = cloneRaycastEnemies(this.currentLevel);
    const spawnMul =
      (this.activeLevelEvent.effects.spawnPressureMultiplier ?? 1) * (this.runModifier?.effects.spawnPressureMul ?? 1);
    const keepChance = spawnMul < 1 ? Math.max(0.52, spawnMul) : 1;
    const seededRng = createSeededLevelEventRng(`${this.currentLevel.id}:spawns`);

    return baseEnemies
      .filter((enemy, index) => index < 2 || seededRng() <= keepChance)
      .map((enemy, index) => this.withVariantApplied(enemy, seededRng, index));
  }

  private withVariantApplied(enemy: RaycastEnemy, rng: () => number, indexSeed = 0): RaycastEnemy {
    const next = { ...enemy };
    const eliteRateBonus = this.runModifier?.effects.eliteRateBonus ?? 0;
    const rolled = rollRaycastEnemyVariant(next.kind, rng, indexSeed, eliteRateBonus);
    const mods = getRaycastVariantModifiers(rolled.variant, this.activeLevelEvent, rng());
    const baseCfg = getEnemyConfig(rolled.kind, 'raycast');
    next.kind = rolled.kind;
    next.variant = rolled.variant;
    next.eliteDisplayName = rolled.eliteDisplayName;
    next.color = baseCfg.color;
    next.variantAccentColor = mods.outlineAccent;
    next.maxHealth = applyRaycastVariantToBaseHealth(baseCfg, mods);
    next.health = next.maxHealth;
    next.damageMultiplier = (next.damageMultiplier ?? 1) * mods.damageMultiplier;
    next.speedMultiplier = (next.speedMultiplier ?? 1) * mods.speedMultiplier;
    next.projectileSpeedMultiplier = (next.projectileSpeedMultiplier ?? 1) * mods.projectileSpeedMultiplier;
    next.frontalDamageReduction = mods.frontalDamageReduction;
    next.exploderBurstDamage = mods.exploderBurstDamage;
    return next;
  }

  private applyCombatShake(durationMs: number, intensity: number): void {
    if (!getScreenshakeEnabled(this.registry)) return;
    this.cameras.main.shake(durationMs, intensity);
  }

  private fireWeapon(): void {
    if (!this.canHandleRaycastInput()) return;
    if (!this.playerAlive || this.levelComplete) return;

    // Co-op: snapshot enemy HP/alive before firing so combat.fire() can produce
    // full visual/audio feedback (hit markers, kill sounds) without mutating
    // server-authoritative state. We restore immediately after.
    type EnemySnapshot = { health: number; alive: boolean };
    const enemySnapshots: EnemySnapshot[] | null = this.netConnected
      ? this.enemies.map((e) => ({ health: e.health, alive: e.alive }))
      : null;

    const result = this.combat.fire(this.player, this.enemies, this.map, this.time.now);

    if (enemySnapshots) {
      for (let i = 0; i < this.enemies.length; i++) {
        const snap = enemySnapshots[i];
        if (snap) {
          this.enemies[i].health = snap.health;
          this.enemies[i].alive = snap.alive;
        }
      }
    }

    if (!result.fired) return;

    // Co-op: report hitscan to the server — server is authoritative for damage.
    if (this.netConnected && this.netClient) {
      const weaponSlot = WEAPON_ORDER.indexOf(result.weaponKind) + 1;
      if (weaponSlot > 0) {
        this.netClient.send({ type: 'shoot', x: this.player.x, y: this.player.y, yaw: this.player.angle, weapon: weaponSlot });
      }
    }

    notifyRaycastGunfire(this.enemies, this.player.x, this.player.y, this.time.now);

    this.runPelletsFired += result.pelletCount;
    if (this.getLiveBosses().length > 0) {
      this.runBossPelletsFired += result.pelletCount;
    }

    applyWeaponFireFeel(this.combatFeelState, result.weaponKind, this.time.now);
    this.flashMuzzle();
    const weaponAudio = getWeaponAudioPlan(result.weaponKind);
    const firePitchMul = getWeaponFireAudioPitch(result.weaponKind);
    this.audioFeedback.play(weaponAudio.cue, weaponAudio.intensity, this.time.now, {
      pitchMul: firePitchMul,
      lowFreqBoost: result.weaponKind === 'SHOTGUN' ? 1.14 : result.weaponKind === 'LAUNCHER' ? 1.06 : 1
    });
    this.applyCombatShake(FIRE_SHAKE_DURATION_MS, Math.min(FIRE_SHAKE_INTENSITY_CAP, FIRE_SHAKE_INTENSITY));
    if (result.weaponKind === 'SHOTGUN') this.gamepadInput?.vibrate('light');

    const liveBosses = this.getLiveBosses();
    if (liveBosses.length > 0) {
      const targetBoss = [...liveBosses].sort(
        (a, b) => Math.hypot(a.x - this.player.x, a.y - this.player.y) - Math.hypot(b.x - this.player.x, b.y - this.player.y)
      )[0];
      const bossHud = getRaycastBossHudLines(targetBoss.displayName);
      const baseBossDamage = computeRaycastBossWeaponDamage(targetBoss, this.player, this.map, result.weaponKind, 'raycast');
      if (baseBossDamage > 0) {
        const bossPellets = countRaycastBossConnectingPellets(targetBoss, this.player, this.map, result.weaponKind, 'raycast');
        const bossDamage = Math.max(1, Math.round(baseBossDamage * this.getPlayerDamageMultiplier()));
        this.runPelletsHitHostile += bossPellets;
        this.runBossPelletsHitHostile += bossPellets;
        const killed = damageRaycastBoss(targetBoss, bossDamage, this.time.now, {
          fromX: this.player.x,
          fromY: this.player.y,
          map: this.map
        });
        const bossCrit = !killed && bossDamage >= Math.ceil(targetBoss.maxHealth * 0.14);
        if (killed) {
          this.runScore += this.applyEventScoreGain(addRaycastBossClearScore(0));
          this.enemiesKilled += 1;
          this.cameras.main.shake(280, 0.0042);
          this.cameras.main.flash(240, 255, 200, 100);
          this.pulseFeedback(0xff4422, 0.22, 440);
          this.setCombatMessage(`NÚCLEO DESTRUIDO // ${targetBoss.displayName.toUpperCase()}`, 2800);
          if (this.currentLevel.id === RAYCAST_LEVEL_BOSS.id && this.rewardTier < 1) {
            this.rewardTier = 1;
            this.playerMaxHealth = this.getBasePlayerMaxHealth();
            this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + 20);
            this.combat.setPlayerDamageMultiplier(this.getPlayerDamageMultiplier());
            this.setCombatMessage('CORE REWARD: +20% DMG  +20 MAX HP', 3400);
            this.emitGameMasterNarration(
              'legendary_pickup',
              { pickupLabel: 'núcleo Volt Archon', rewardTier: this.rewardTier },
              'core-volt',
            );
          } else if (this.currentLevel.id === 'bloom-warden-pit' && this.rewardTier < 2) {
            this.rewardTier = 2;
            this.playerMaxHealth = this.getBasePlayerMaxHealth();
            this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + 24);
            this.combat.setPlayerDamageMultiplier(this.getPlayerDamageMultiplier());
            this.setCombatMessage('CORE REWARD: +40% DMG TOTAL  +44 MAX HP', 3600);
            this.emitGameMasterNarration(
              'legendary_pickup',
              { pickupLabel: 'núcleo Bloom Warden', rewardTier: this.rewardTier },
              'core-bloom',
            );
          }
          this.audioFeedback.play('episodeComplete', 1, this.time.now);
          this.gamepadInput?.vibrate('boss');
        }
        const bossImpactAudio = getCombatImpactAudioOptions(result.weaponKind, killed, bossCrit);
        if (killed) {
          this.freezeFrameUntil = this.time.now + getDeathFeedbackProfile(true).freezeMs;
          this.audioFeedback.play('kill', 1.02 * bossImpactAudio.intensityMul, this.time.now, {
            pitchMul: bossImpactAudio.pitchMul,
            lowFreqBoost: bossImpactAudio.lowFreqBoost
          });
        } else if (bossCrit) {
          this.audioFeedback.play('hitCrit', 0.96 * bossImpactAudio.intensityMul, this.time.now, {
            pitchMul: bossImpactAudio.pitchMul,
            lowFreqBoost: bossImpactAudio.lowFreqBoost
          });
        } else {
          this.audioFeedback.play('hit', 0.86 * bossImpactAudio.intensityMul, this.time.now, {
            pitchMul: bossImpactAudio.pitchMul,
            lowFreqBoost: bossImpactAudio.lowFreqBoost
          });
        }
        this.pulseCrosshair(killed ? '#ff5b6f' : bossCrit ? '#8dffcf' : '#ffffff', killed ? 124 : bossCrit ? 102 : 88);
        this.flashHitMarker(killed, false, bossCrit);
        this.applyCombatShake(killed ? 96 : bossCrit ? 72 : 54, killed ? 0.00225 : bossCrit ? 0.00172 : 0.00132);
        if (!killed) this.setCombatMessage(bossHud.hullStressed);
        return;
      }
    }

    if (!result.hitEnemy) {
      this.flashWallImpact();
      this.pulseCrosshair(this.hudCss.accentText, 72);
      this.pulseFeedback(RAYCAST_PALETTE.plasmaBright, 0.055, 84);
      this.audioFeedback.play('wallImpact', 0.9, this.time.now);
      this.setCombatMessage('IMPACTO EN MURO');
      return;
    }

    this.runPelletsHitHostile += result.hitCount + result.splashHitCount;
    this.enemiesKilled += result.killCount;
    if (result.killedEnemyKinds.length > 0) {
      this.runScore += this.applyEventScoreGain(addRaycastKillScore(0, result.killedEnemyKinds));
      const eliteBonus = getRaycastEliteKillScoreBonus(this.enemies, this.time.now);
      if (eliteBonus > 0) {
        this.runScore += this.applyEventScoreGain(eliteBonus);
        this.setCombatMessage('ELITE TERMINATED // BONUS CORE', 1400);
      }
    }
    const splashImpact = result.weaponKind === 'LAUNCHER' && result.splashHitCount > 0;
    if (splashImpact) {
      this.audioFeedback.play('splash', 0.9, this.time.now);
      this.applyCombatShake(102, 0.00285);
      this.pulseFeedback(0xff8a3d, 0.075, 102);
    }
    const impactAudio = getCombatImpactAudioOptions(result.weaponKind, result.killed, result.anyCrit);
    if (result.killed) {
      this.freezeFrameUntil = this.time.now + getDeathFeedbackProfile(false).freezeMs;
      this.audioFeedback.play('kill', 1.02 * impactAudio.intensityMul, this.time.now, {
        pitchMul: impactAudio.pitchMul,
        lowFreqBoost: impactAudio.lowFreqBoost
      });
    } else if (result.anyCrit) {
      this.audioFeedback.play('hitCrit', 0.95 * impactAudio.intensityMul, this.time.now, {
        pitchMul: impactAudio.pitchMul,
        lowFreqBoost: impactAudio.lowFreqBoost
      });
    } else {
      this.audioFeedback.play('hit', 0.84 * impactAudio.intensityMul, this.time.now, {
        pitchMul: impactAudio.pitchMul,
        lowFreqBoost: impactAudio.lowFreqBoost
      });
    }
    if (result.killed) {
      this.cameras.main.flash(48, 255, 236, 210, false);
      this.pulseFeedback(0xffe2c4, 0.09, 142);
    } else if (result.anyCrit) {
      this.cameras.main.flash(22, 120, 255, 200, false);
      this.pulseFeedback(0x58e0ff, 0.055, 95);
    }
    const critRead = result.anyCrit && !result.killed;
    this.pulseCrosshair(result.killed ? '#ff5b6f' : critRead ? '#7dffd4' : '#ffffff', result.killed ? 148 : critRead ? 108 : 92);
    this.flashHitMarker(result.killed, splashImpact, critRead);
    const weapon = result.weaponKind;
    const killShake = weapon === 'SHOTGUN' ? { d: 102, i: 0.00218 } : weapon === 'LAUNCHER' ? { d: 98, i: 0.00258 } : { d: 88, i: 0.00195 };
    const hitShake = weapon === 'SHOTGUN' ? { d: 52, i: 0.00128 } : weapon === 'LAUNCHER' ? { d: 48, i: 0.00138 } : { d: 46, i: 0.00118 };
    const critShake = weapon === 'SHOTGUN' ? { d: 68, i: 0.00158 } : weapon === 'LAUNCHER' ? { d: 62, i: 0.00168 } : { d: 58, i: 0.00142 };
    const s = result.killed ? killShake : critRead ? critShake : hitShake;
    this.applyCombatShake(s.d, s.i);
    this.setCombatMessage(
      result.killed
        ? getRaycastCombatMessageForSegment(this.getWorldSegment(), 'kill')
        : splashImpact
          ? `SPLASH HIT x${Math.max(1, result.splashHitCount)}`
          : result.hitCount > 1
            ? `HOSTILE PROCESS HIT x${result.hitCount}`
            : critRead
              ? `CHUNK HIT -${result.totalDamage}`
              : `HOSTILE PROCESS HIT -${result.totalDamage}`,
      result.killed ? 1720 : splashImpact ? 1320 : 1200
    );
  }

  private flashMuzzle(): void {
    const weapon = this.combat.getCurrentWeapon();
    const width = weapon === 'SHOTGUN' ? 204 : weapon === 'LAUNCHER' ? 162 : 108;
    const height = weapon === 'SHOTGUN' ? 64 : weapon === 'LAUNCHER' ? 58 : 36;
    const alpha = weapon === 'SHOTGUN' ? 1 : weapon === 'LAUNCHER' ? 0.98 : 0.94;
    const flashDuration = weapon === 'LAUNCHER' ? 238 : weapon === 'SHOTGUN' ? 148 : 76;
    this.tweens.killTweensOf(this.muzzleFlash);
    this.muzzleFlash.setY(this.muzzleFlashAnchorY + 10);
    this.muzzleFlash.setSize(width, height);
    this.muzzleFlash.setFillStyle(weapon === 'LAUNCHER' ? RAYCAST_PALETTE.plasmaBright : weapon === 'SHOTGUN' ? 0xff8a3d : RAYCAST_ATMOSPHERE.muzzleFlash);
    this.muzzleFlash.setAlpha(Math.min(FIRE_MUZZLE_ALPHA_CAP, alpha));
    this.weaponOverlayFlashUntil = this.time.now + flashDuration;
    this.tweens.add({
      targets: this.muzzleFlash,
      y: this.muzzleFlashAnchorY,
      duration: 92,
      ease: 'Quad.easeOut'
    });
    this.tweens.add({
      targets: this.muzzleFlash,
      alpha: 0,
      duration: Math.max(52, Math.round(flashDuration * 0.74)),
      ease: 'Quad.easeOut'
    });
  }

  private flashWallImpact(): void {
    this.wallImpactFlash.setScale(0.62);
    this.wallImpactFlash.setAlpha(0.65);
    this.tweens.killTweensOf(this.wallImpactFlash);
    this.tweens.add({
      targets: this.wallImpactFlash,
      alpha: 0,
      scale: 1.8,
      duration: 112,
      ease: 'Quad.easeOut'
    });
  }

  private flashHitMarker(killed: boolean, splash: boolean, crit = false): void {
    const label = killed ? '*' : crit ? '!' : splash ? 'xx' : 'x';
    const color = killed ? '#ff3358' : crit ? '#5dffc8' : splash ? '#ffb36b' : '#ffffff';
    const timing = getHitMarkerFeedbackTiming(killed, crit, splash);
    this.hitMarker.setText(label);
    this.hitMarker.setColor(color);
    this.hitMarker.setScale(timing.scaleStart);
    this.hitMarker.setAlpha(0.98);
    this.tweens.killTweensOf(this.hitMarker);
    this.tweens.add({
      targets: this.hitMarker,
      alpha: 0,
      scale: timing.scaleEnd,
      duration: timing.durationMs,
      ease: 'Quad.easeOut'
    });
  }

  private pulseCrosshair(color: string, duration: number): void {
    this.crosshair.setColor(color);
    this.crosshair.setScale(1.22);
    this.tweens.killTweensOf(this.crosshair);
    this.tweens.add({
      targets: this.crosshair,
      scale: 1,
      duration,
      ease: 'Quad.easeOut',
      onComplete: () => this.crosshair.setColor('#fff0c2')
    });
  }

  private pulseFeedback(color: number, alpha: number, duration: number): void {
    this.feedbackPulse.setFillStyle(color, alpha);
    this.feedbackPulse.setAlpha(alpha);
    this.tweens.killTweensOf(this.feedbackPulse);
    this.tweens.add({
      targets: this.feedbackPulse,
      alpha: 0,
      duration,
      ease: 'Quad.easeOut'
    });
  }

  private getWeaponOverlayFlashAlpha(): number {
    if (this.time.now >= this.weaponOverlayFlashUntil) return 0;
    const decayWindow = getMuzzleFlashDecayMs(this.combat.getCurrentWeapon());
    return Phaser.Math.Clamp((this.weaponOverlayFlashUntil - this.time.now) / decayWindow, 0, 1);
  }

  private setCombatMessage(message: string, holdMs = 1100): void {
    this.lastCombatMessage = message.toUpperCase();
    this.combatMessageUntil = this.time.now + holdMs;
    this.tweens.killTweensOf(this.systemText);
    this.systemText.setAlpha(0.86);
    this.tweens.add({
      targets: this.systemText,
      alpha: 1,
      duration: 150,
      ease: 'Quad.easeOut'
    });
  }

  private pushPickupToast(kind: RaycastPickupToastKind, amount?: number, label?: string): void {
    this.pickupToastQueue = pushRaycastPickupToast(this.pickupToastQueue, {
      kind,
      nowMs: this.time.now,
      amount,
      label
    });
  }

  private updatePickupToast(): void {
    const toast = getRaycastPickupToastDisplay(this.pickupToastQueue, this.time.now);
    this.pickupToastQueue = pruneRaycastPickupToastQueue(this.pickupToastQueue, this.time.now);
    if (!toast || this.finalOverlay.visible || this.gamePaused) {
      this.pickupToastText.setVisible(false).setAlpha(0);
      return;
    }
    const remainingMs = toast.expiresAtMs - this.time.now;
    const fadeAlpha =
      remainingMs <= RAYCAST_PICKUP_TOAST_FADE_MS ? Phaser.Math.Clamp(remainingMs / RAYCAST_PICKUP_TOAST_FADE_MS, 0, 1) : 1;
    this.pickupToastText
      .setText(toast.text)
      .setColor(toast.color)
      .setPosition(this.pickupToastLayout.x, this.pickupToastLayout.y)
      .setVisible(true)
      .setAlpha(fadeAlpha * 0.94);
  }

  private buildGamepadStatusLabel(): string {
    return formatRaycastGamepadStatusLabel(this.gamepadInput.getDebugInfo());
  }

  private buildGamepadDebugLine(): string {
    return formatRaycastGamepadDebugLine(this.gamepadInput.getDebugInfo());
  }

  private switchWeapon(slot: number): void {
    if (!this.canHandleRaycastInput()) return;
    if (!this.playerAlive || this.levelComplete) return;
    const previous = this.combat.getCurrentWeapon();
    this.combat.switchWeaponSlot(slot);
    applyWeaponSwitchFeel(this.combatFeelState, previous, this.combat.getCurrentWeapon(), this.time.now);
    this.setCombatMessage(`WEAPON ROUTED: ${this.combat.getWeaponLabel()}`);
  }

  private cycleWeapon(direction: number): void {
    if (this.gamePaused) return;
    if (!this.canHandleRaycastInput()) return;
    if (!this.playerAlive || this.levelComplete) return;
    const current = this.combat.getCurrentWeapon();
    const nextSlot =
      current === 'PISTOL' ? (direction > 0 ? 2 : 3) : current === 'SHOTGUN' ? (direction > 0 ? 3 : 1) : direction > 0 ? 1 : 2;
    this.switchWeapon(nextSlot);
  }

  private countLivingEnemies(): number {
    return this.enemies.filter((enemy) => enemy.alive).length;
  }

  private countReachableLivingEnemies(): number {
    return this.enemies.filter((enemy) => enemy.alive && isRaycastMapPointReachable(this.map, this.player, enemy)).length;
  }

  private countLivingEnemyKinds(): Partial<Record<EnemyKind, number>> {
    const tally: Partial<Record<EnemyKind, number>> = {};
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      tally[enemy.kind] = (tally[enemy.kind] ?? 0) + 1;
    }
    return tally;
  }

  private applyMinimapToggle(): void {
    this.minimapVisible = !this.minimapVisible;
    this.minimapFrame?.setVisible(this.minimapVisible);
    this.minimapTitleText?.setVisible(this.minimapVisible);
    this.minimapGraphics?.setVisible(this.minimapVisible);
    this.minimapMarkerLabels.forEach((label) => label.setVisible(false));
    if (this.gamePaused) this.applyPauseMinimapPresentation();
  }

  private applyPauseMinimapPresentation(): void {
    if (!this.minimapVisible) {
      this.minimapFrame?.setVisible(false);
      this.minimapTitleText?.setVisible(false);
      this.minimapGraphics?.setVisible(false);
      this.minimapMarkerLabels.forEach((label) => label.setVisible(false));
      return;
    }
    this.minimapFrame?.setVisible(true);
    this.minimapTitleText?.setVisible(true);
    this.minimapGraphics?.setVisible(true);
    this.minimapFrame?.setAlpha(0.08);
    this.minimapTitleText?.setAlpha(0.08);
    this.minimapGraphics?.setAlpha(0.08);
  }

  private restoreGameplayMinimapPresentation(): void {
    if (!this.minimapVisible) {
      this.minimapFrame?.setVisible(false);
      this.minimapTitleText?.setVisible(false);
      this.minimapGraphics?.setVisible(false);
      this.minimapMarkerLabels.forEach((label) => label.setVisible(false));
      return;
    }
    this.minimapFrame?.setVisible(true);
    this.minimapTitleText?.setVisible(true);
    this.minimapGraphics?.setVisible(true);
    this.minimapFrame?.setAlpha(0.76);
    this.minimapTitleText?.setAlpha(1);
    this.minimapGraphics?.setAlpha(1);
  }

  private applyDebugHudToggle(): void {
    this.debugHudVisible = !this.debugHudVisible;
    this.debugText?.setVisible(this.debugHudVisible);
  }

  private stopGameMasterPresentation(reason: string): void {
    stopGameMasterVoice(reason);
    this.narrationOverlay?.clearTransmission();
  }

  /** Death uses a fixed critical line locally — no async narrate (avoids stale voice/text). */
  private deliverPlayerDeathGameMaster(): void {
    this.stopGameMasterPresentation('player_death');
    this.deliverGameMasterNarration(PLAYER_DEATH_GM_MESSAGE, 'fallback', 'critical');
  }

  private deliverGameMasterNarration(
    message: string,
    source: GameMasterSource,
    tier: GameMasterNarrationTier = 'ambient',
  ): void {
    this.lastGmSource = source;
    this.lastGmTier = tier;
    const line = this.formatGameMasterOverlayMessage(message);
    if (!line) return;
    if (getGameMasterNarrationEnabled(this.registry)) {
      this.narrationOverlay?.showNarration(line, tier);
    }
    if (getGameMasterVoiceEnabled(this.registry)) {
      speakGameMasterVoice(line, {
        volume: getGameMasterVoiceVolume(this.registry),
        tier,
        urgent: tier === 'critical',
      });
    }
  }

  private formatGameMasterOverlayMessage(message: string): string {
    const normalized = message.replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    const maxLen = 148;
    if (normalized.length <= maxLen) return normalized;
    return `${normalized.slice(0, maxLen - 1)}…`;
  }

  private updateNarrationOverlay(): void {
    const suppressed = this.gamePaused || this.finalOverlay.visible;
    this.narrationOverlay.setSuppressed(suppressed);
    if (suppressed) return;
    this.narrationOverlayTick += 1;
    if (this.narrationOverlayTick % 2 !== 0) return;
    this.narrationOverlay.update(this.time.now);
  }

  private buildGameMasterHudStatusLine(): string {
    return formatGameMasterHudStatusLine({
      narrationEnabled: getGameMasterNarrationEnabled(this.registry),
      inFlight: this.gameMasterNarration?.isNarrationInFlight() ?? false,
      voiceEnabled: getGameMasterVoiceEnabled(this.registry),
      lastTier: this.gameMasterNarration?.getLastHudTier() ?? this.lastGmTier,
      lastSource: this.lastGmSource,
    });
  }

  private buildGameMasterStatusForSettings(): string {
    const voice = formatGameMasterVoiceHudLabel(getGameMasterVoiceEnabled(this.registry));
    if (!getGameMasterNarrationEnabled(this.registry)) {
      return getGameMasterVoiceEnabled(this.registry) ? `narr off · voice ${voice}` : 'off';
    }
    if (this.gameMasterNarration?.isNarrationInFlight()) return `pending · voice ${voice}`;
    const narr =
      this.lastGmSource === 'ollama' || this.lastGmSource === 'fallback'
        ? this.lastGmSource
        : 'idle';
    return `${narr} · voice ${voice}`;
  }

  private buildDebugHudExtrasLine(): string {
    return formatRaycastDebugHudExtras({
      fpsCurrent: this.frameStats.fps,
      fpsTarget: getFpsTarget(this.registry),
      renderQualityLabel: formatRenderQualityLabel(getRenderQuality(this.registry)),
      gmStatusLine: this.buildGameMasterHudStatusLine(),
    });
  }

  private applyPausePanelLayout(): void {
    const layout = computeRaycastPausePanelLayout(this.scale.width, this.scale.height);
    this.pausePanel.setPosition(layout.centerX, layout.centerY);
    this.pausePanel.setSize(layout.panelWidth, layout.panelHeight);
    this.pauseTitleText.setPosition(layout.centerX, layout.titleY);
    this.pauseMenuBodyText.setPosition(layout.centerX - layout.bodyWrapWidth * 0.5, layout.bodyY);
    this.pauseMenuBodyText.setWordWrapWidth(layout.bodyWrapWidth);
    this.pauseMenuBodyText.setFontSize(layout.fontSize);
    this.pauseMenuBodyText.setLineSpacing(layout.lineSpacing);
  }

  private applyPerformanceSettings(): void {
    applyFpsTargetToGame(this.game, getFpsTarget(this.registry));
  }

  private buildGameMasterSnapshotForScene(
    extras: Partial<Parameters<typeof buildRaycastGameMasterSnapshot>[0]> = {},
  ) {
    const ammo = this.combat.getAmmoState();
    const objectiveState = this.getObjectiveState();
    const objectiveLabel = formatRaycastObjectiveHudLabel(
      buildRaycastCurrentObjective(objectiveState),
      this.currentLevel.hudObjectiveLabels,
    );
    return buildRaycastGameMasterSnapshot({
      levelId: this.currentLevel.id,
      levelName: this.currentLevel.name,
      worldSegment: this.getWorldSegment(),
      difficultyId: this.difficultyId,
      playerHealth: this.playerHealth,
      playerMaxHealth: this.playerMaxHealth,
      equippedWeapon: this.combat.getCurrentWeapon(),
      activeEnemies: this.countLivingEnemies(),
      runStartedAtMs: this.runStartedAt,
      ammoCurrent: ammo.current,
      ammoCapacity: ammo.capacity,
      currentWave: this.getActivatedTriggerCount() + 1,
      directorState: this.lastDirectorState,
      directorIntensityPercent: Math.round(Phaser.Math.Clamp(this.directorIntensity * 100, 0, 100)),
      nowMs: this.time.now,
      zoneId: this.activeZoneId,
      objectiveLabel,
      ...extras,
    });
  }

  private emitGameMasterNarration(
    eventId: GameMasterNarrationEventId,
    extras: Partial<Parameters<typeof buildRaycastGameMasterSnapshot>[0]> = {},
    dedupeSuffix?: string,
  ): void {
    if (!getGameMasterNarrationEnabled(this.registry)) return;
    this.gameMasterNarration.requestEvent(
      eventId,
      this.buildGameMasterSnapshotForScene(extras),
      dedupeSuffix ? { dedupeSuffix } : undefined,
    );
  }

  private requestBossSpawnGameMasterNarration(): void {
    const bossConfig = this.currentLevel.bossConfig;
    if (!bossConfig) return;

    this.emitGameMasterNarration(
      'boss_spawn',
      {
        bossDisplayName: bossConfig.displayName,
        bossBehavior: bossConfig.behavior ?? 'volt-archon',
        twinBossPresent: this.currentLevel.id === 'ash-judge-seal',
      },
      bossConfig.id,
    );
  }

  private openPauseMenu(): void {
    this.gamePaused = true;
    this.pauseSelectionIndex = 0;
    this.pausePanelMode = 'main';
    this.applyPausePanelLayout();
    this.touchInput?.resetActiveContactState();
    this.touchInput?.setMode('ui');
    this.pauseDim.setVisible(true);
    this.pausePanel.setVisible(true);
    this.pauseTitleText.setVisible(true);
    this.pauseMenuBodyText.setVisible(true);
    this.applyPauseMinimapPresentation();
    this.controller?.suppressLookInput(2);
    this.refreshPauseMenuBody();
    this.audioFeedback.play('uiSoftDeny', 0.62, this.time.now);
  }

  private closePauseMenu(): void {
    this.gamePaused = false;
    this.pausePanelMode = 'main';
    this.pauseControlSelectionIndex = 1;
    this.touchInput?.resetActiveContactState();
    this.touchInput?.setMode('gameplay');
    this.pauseDim.setVisible(false);
    this.pausePanel.setVisible(false);
    this.pauseTitleText.setVisible(false);
    this.pauseMenuBodyText.setVisible(false);
    this.restoreGameplayMinimapPresentation();
    this.controller?.suppressLookInput(2);
    this.audioFeedback.play('uiConfirm', 0.72, this.time.now);
  }

  private openControlSettingsPanel(): void {
    this.pausePanelMode = 'control';
    this.pauseControlSelectionIndex = 1;
    this.applyPausePanelLayout();
    this.touchInput?.setMode('ui');
    this.controller?.suppressLookInput(2);
    this.refreshPauseMenuBody();
    this.audioFeedback.play('uiConfirm', 0.68, this.time.now);
  }

  private closeControlSettingsPanel(): void {
    this.pausePanelMode = 'main';
    this.pauseSelectionIndex = Math.min(this.pauseSelectionIndex, RAYCAST_PAUSE_MENU_LABELS.length - 1);
    this.touchInput?.setMode('ui');
    this.controller?.suppressLookInput(2);
    this.refreshPauseMenuBody();
    this.audioFeedback.play('uiConfirm', 0.68, this.time.now);
  }

  private openSettingsPanel(): void {
    this.pausePanelMode = 'settings';
    this.pauseSettingsSelectionIndex = 0;
    this.applyPausePanelLayout();
    this.touchInput?.setMode('ui');
    this.controller?.suppressLookInput(2);
    this.refreshPauseMenuBody();
    this.audioFeedback.play('uiConfirm', 0.68, this.time.now);
  }

  private closeSettingsPanel(): void {
    this.pausePanelMode = 'main';
    this.pauseSelectionIndex = Math.min(this.pauseSelectionIndex, RAYCAST_PAUSE_MENU_LABELS.length - 1);
    this.touchInput?.setMode('ui');
    this.controller?.suppressLookInput(2);
    this.refreshPauseMenuBody();
    this.audioFeedback.play('uiConfirm', 0.68, this.time.now);
  }

  private triggerGameMasterTestFromPause(): void {
    const voiceOn = getGameMasterVoiceEnabled(this.registry);
    const narrOn = getGameMasterNarrationEnabled(this.registry);
    if (!voiceOn && !narrOn) {
      this.setCombatMessage('GAME MASTER APAGADO', 1800);
      this.refreshPauseMenuBody();
      return;
    }
    if (voiceOn) {
      const phrase = getGameMasterVoiceTestPhrase();
      if (narrOn) {
        this.deliverGameMasterNarration(phrase, 'fallback', 'important');
      } else {
        speakGameMasterVoice(phrase, {
          urgent: true,
          volume: getGameMasterVoiceVolume(this.registry),
          tier: 'important',
        });
        this.setCombatMessage('PRUEBA DE VOZ GM', 1600);
      }
    } else {
      this.emitGameMasterNarration('manual_debug', {}, `pause-g-${Math.floor(this.time.now)}`);
    }
    this.refreshPauseMenuBody();
    this.audioFeedback.play('uiConfirm', 0.68, this.time.now);
  }

  private refreshPauseMenuBody(): void {
    const volPct = Math.round(this.audioMasterVolume * 100);
    const activeInput = this.resolveSceneActiveInput();
    if (this.pausePanelMode === 'settings') {
      this.pauseMenuBodyText.setText(
        formatRaycastSettingsPauseBody({
          activeInput,
          selectionIndex: this.pauseSettingsSelectionIndex,
          gmNarration: getGameMasterNarrationEnabled(this.registry) ? 'SÍ' : 'NO',
          gmVoice: getGameMasterVoiceEnabled(this.registry) ? 'SÍ' : 'NO',
          gmVoiceVolume: `${Math.round(getGameMasterVoiceVolume(this.registry) * 100)}%`,
          gmStatus: this.buildGameMasterStatusForSettings(),
          gmTestHint: 'ENTER voz · G en juego',
          fpsTarget: formatFpsTargetLabel(getFpsTarget(this.registry)),
          renderQuality: formatRenderQualityLabel(getRenderQuality(this.registry)),
          minimapQuality: formatMinimapQualityLabel(getMinimapQuality(this.registry)),
          debugPerfHud: this.perfHudVisible ? 'SÍ' : 'NO',
          debugGmLogs: getGameMasterNarrationDebug(this.registry) ? 'SÍ' : 'NO',
        }),
      );
      return;
    }
    if (this.pausePanelMode === 'control') {
      this.pauseMenuBodyText.setText(
        formatRaycastControlPauseBody(
          {
            activeInput,
            controlStatus: this.buildGamepadStatusLabel(),
            gamepadDebugLine: this.buildGamepadDebugLine(),
            gamepadLiveLine: this.gamepadInput.getDebugInfo().liveInputLine ?? undefined,
            selectionIndex: this.pauseControlSelectionIndex,
            mouseSensitivity: `x${getMouseSensitivity(this.registry).toFixed(2)}`,
            gamepadSensitivity: `x${getGamepadSensitivity(this.registry).toFixed(2)}`,
            leftDeadzone: getGamepadLeftDeadzone(this.registry).toFixed(2),
            rightDeadzone: getGamepadRightDeadzone(this.registry).toFixed(2),
            invertY: getGamepadInvertY(this.registry) ? 'SÍ' : 'NO',
            vibration: getGamepadVibrationEnabled(this.registry) ? 'SÍ' : 'NO',
            screenshake: getScreenshakeEnabled(this.registry) ? 'SÍ' : 'NO',
            minimap: getMinimapDefaultVisible(this.registry) ? 'SÍ' : 'NO',
          },
          { columnChars: 31 }
        )
      );
      return;
    }
    const objectiveState = this.getObjectiveState();
    const objective = this.getEventAwareObjectiveText(
      formatRaycastObjectiveHudLabel(buildRaycastCurrentObjective(objectiveState), this.currentLevel.hudObjectiveLabels)
    );
    const hint = this.getEventAwareHintText(buildRaycastHintText(objectiveState));
    const preset = getRaycastDifficultyPreset(this.difficultyId);
    let modifiersLine = [this.activeLevelEvent.name, this.runModifier?.label].filter((entry): entry is string => Boolean(entry)).join(' | ');
    if (modifiersLine.length === 0) modifiersLine = 'Ninguno';
    if (this.passiveRegenHudActive && this.passiveRegenHudLabel) {
      modifiersLine = `${modifiersLine} · ${this.passiveRegenHudLabel}`;
    } else if (this.passiveRegenHudLabel) {
      modifiersLine = `${modifiersLine} · ${this.passiveRegenHudLabel}`;
    }

    this.pauseMenuBodyText.setText(
      formatRaycastPauseMenuMxBody(
        {
          activeInput,
          volumePct: volPct,
          selectionIndex: this.pauseSelectionIndex,
          worldLine: this.pauseRunBannerLine,
          difficultyLabel: preset.label,
          score: this.runScore,
          highScore: readRaycastHighScore(),
          missionLine: 'Recupera la señal perdida y escapa del complejo.',
          objectiveLine: objective,
          hintLine: hint,
          tokensLine: `Fichas · ${this.getKeyCount()}/${this.currentLevel.keys.length}`,
          secretsLine: `Secretos · ${this.collectedSecrets.size}/${this.currentLevel.secrets.length}`,
          modifiersLine
        },
        { columnChars: 28 }
      )
    );
  }

  private getWrappedControlSelectionIndex(delta: number): number {
    const maxIndex = RAYCAST_CONTROL_PAUSE_ROWS.length - 1;
    const selectableMin = 1;
    const current = Math.max(selectableMin, Math.min(this.pauseControlSelectionIndex, maxIndex));
    const next = current + delta;
    if (next > maxIndex) return selectableMin;
    if (next < selectableMin) return maxIndex;
    return next;
  }

  private getWrappedSettingsSelectionIndex(delta: number): number {
    const maxIndex = RAYCAST_SETTINGS_PAUSE_ROWS.length - 1;
    const next = this.pauseSettingsSelectionIndex + delta;
    if (next > maxIndex) return 0;
    if (next < 0) return maxIndex;
    return next;
  }

  private adjustPauseSubmenuSetting(direction: number): void {
    if (this.pausePanelMode === 'control') {
      this.adjustControlSetting(direction);
      return;
    }
    if (this.pausePanelMode === 'settings') {
      this.adjustSettingsSetting(direction);
    }
  }

  private adjustSettingsSetting(direction: number): void {
    const row = RAYCAST_SETTINGS_PAUSE_ROWS[this.pauseSettingsSelectionIndex];
    const flip = (value: boolean): boolean => !value;
    switch (row) {
      case 'gm_narration':
        setGameMasterNarrationEnabled(this.registry, flip(getGameMasterNarrationEnabled(this.registry)));
        break;
      case 'gm_voice':
        setGameMasterVoiceEnabled(this.registry, flip(getGameMasterVoiceEnabled(this.registry)));
        break;
      case 'gm_voice_volume':
        adjustGameMasterVoiceVolume(this.registry, direction * 0.1);
        break;
      case 'fps_target':
        setFpsTarget(this.registry, cycleFpsTarget(getFpsTarget(this.registry), direction));
        this.applyPerformanceSettings();
        break;
      case 'render_quality':
        setRenderQuality(this.registry, cycleRenderQuality(getRenderQuality(this.registry), direction));
        break;
      case 'minimap_quality':
        setMinimapQuality(this.registry, cycleMinimapQuality(getMinimapQuality(this.registry), direction));
        break;
      case 'debug_perf_hud':
        this.perfHudVisible = flip(this.perfHudVisible);
        this.perfText?.setVisible(this.perfHudVisible);
        break;
      case 'debug_gm_logs':
        setGameMasterNarrationDebug(this.registry, flip(getGameMasterNarrationDebug(this.registry)));
        this.narrationOverlay?.applyConfig(
          { displayMs: getGameMasterNarrationDurationMs(this.registry) },
          { debug: getGameMasterNarrationDebug(this.registry) },
        );
        break;
      case 'gm_test':
      case 'back':
        return;
      default:
        return;
    }
    this.audioFeedback.play('uiConfirm', 0.62, this.time.now);
    this.refreshPauseMenuBody();
  }

  private adjustControlSetting(direction: number): void {
    const row = RAYCAST_CONTROL_PAUSE_ROWS[this.pauseControlSelectionIndex];
    const flip = (value: boolean): boolean => !value;
    switch (row) {
      case 'mouse':
        setMouseSensitivity(this.registry, getMouseSensitivity(this.registry) + direction * 0.05);
        break;
      case 'pad_sens':
        setGamepadSensitivity(this.registry, getGamepadSensitivity(this.registry) + direction * 0.05);
        break;
      case 'left_deadzone':
        setGamepadLeftDeadzone(this.registry, getGamepadLeftDeadzone(this.registry) + direction * 0.01);
        break;
      case 'right_deadzone':
        setGamepadRightDeadzone(this.registry, getGamepadRightDeadzone(this.registry) + direction * 0.01);
        break;
      case 'invert_y':
        setGamepadInvertY(this.registry, flip(getGamepadInvertY(this.registry)));
        break;
      case 'vibration':
        setGamepadVibrationEnabled(this.registry, flip(getGamepadVibrationEnabled(this.registry)));
        break;
      case 'screenshake':
        setScreenshakeEnabled(this.registry, flip(getScreenshakeEnabled(this.registry)));
        break;
      case 'minimap':
        setMinimapDefaultVisible(this.registry, flip(getMinimapDefaultVisible(this.registry)));
        break;
      case 'back':
        this.closeControlSettingsPanel();
        return;
      default:
        return;
    }
    this.audioFeedback.play('uiConfirm', 0.62, this.time.now);
    this.refreshPauseMenuBody();
  }

  private adjustAudioMasterVolume(delta: number): void {
    this.audioMasterVolume = Math.max(0, Math.min(1, this.audioMasterVolume + delta));
    this.audioFeedback.setMasterVolume(this.audioMasterVolume);
    setSessionMasterVolume(this.registry, this.audioMasterVolume);
  }

  private applyPassiveHeal(delta: number): void {
    if (!this.playerAlive || this.levelComplete) return;
    const directorScale = computePassiveHealCombatScale(this.lastDirectorState, this.directorIntensity);
    const swarm = computeEnemySwarmHealScale(this.countLivingEnemies());
    const bossScale = this.getLiveBosses().length > 0 ? 0.45 : 1;
    const eventScale = this.activeLevelEvent.effects.passiveHealMultiplier ?? 1;
    const runScale = this.runModifier?.effects.passiveHealMul ?? 1;
    const combatScale = directorScale * swarm * bossScale * eventScale * runScale;
    const baseConfig = getRaycastDifficultyPassiveHealConfig(this.difficultyId);
    const config = {
      ...baseConfig,
      maxHealth: this.playerMaxHealth,
      delayAfterDamageMs: Math.round(baseConfig.delayAfterDamageMs * (this.runModifier?.effects.passiveHealDelayMul ?? 1))
    };
    const result = tickRaycastPassiveHeal({
      health: this.playerHealth,
      nowMs: this.time.now,
      lastDamageAtMs: this.lastPlayerDamageAt,
      deltaMs: delta,
      config,
      combatScale,
      fractionalCarry: this.passiveHealFractionalCarry
    });
    this.playerHealth = result.nextHealth;
    this.passiveRegenHudActive = result.isRegenerating;
    this.passiveRegenHudLabel = formatRaycastPassiveRegenHudLabel(
      getRaycastPassiveRegenHudState({
        health: this.playerHealth,
        nowMs: this.time.now,
        lastDamageAtMs: this.lastPlayerDamageAt,
        config,
        combatScale,
        isRegenerating: result.isRegenerating
      })
    );
    this.passiveHealFractionalCarry = result.nextFractionalCarry;
    if (result.healingThisTick > 0) this.runUsedPassiveRegen = true;
  }

  private updateEnemies(delta: number): void {
    const liveBosses = this.getLiveBosses();
    this.trySpawnBossAdds(liveBosses);
    const bossPlayerCtx = {
      x: this.player.x,
      y: this.player.y,
      alive: this.playerAlive,
      stationaryMs: this.playerStationaryMs,
      vx: this.player.velocity.x,
      vy: this.player.velocity.y
    };
    for (const boss of liveBosses) {
      tickRaycastBossMovement(boss, this.map, bossPlayerCtx, delta, this.time.now);
      const bossHud = getRaycastBossHudLines(boss.displayName);
      if (isBossDesperation(boss) && !boss.desperationAnnounced) {
        boss.desperationAnnounced = true;
        this.audioFeedback.play('bossPhaseShift', 1, this.time.now);
        this.pulseFeedback(0xff3a4a, 0.14, 300);
        this.cameras.main.shake(150, 0.0022);
        this.setCombatMessage(getDesperationPhaseLabel(boss.behavior), 2200);
      }
      const prevPhase = this.lastBossPhaseById.get(boss.id);
      if (prevPhase !== boss.phase) {
        if (boss.phase >= 2) {
          this.audioFeedback.play('bossPhaseShift', 1, this.time.now);
          this.pulseFeedback(boss.phase === 3 ? 0xff2f41 : 0xff5b6f, boss.phase === 3 ? 0.15 : 0.11, 260);
          this.cameras.main.shake(boss.phase === 3 ? 168 : 132, boss.phase === 3 ? 0.0024 : 0.00195);
          this.setCombatMessage(boss.phase === 3 ? `${bossHud.phase3Overdrive} // FINAL RAGE` : `${bossHud.phase2Overdrive} // ESCALATE`);
        }
        this.lastBossPhaseById.set(boss.id, boss.phase);
      }
      const telegraphActive = this.time.now < boss.telegraphUntil;
      if (telegraphActive && !this.bossTelegraphById.get(boss.id)) {
        this.audioFeedback.play('directorWarning', 0.95, this.time.now);
        this.audioFeedback.play('stingerDread', 0.44, this.time.now + 42);
        this.pulseFeedback(0xffb347, 0.08, 170);
        this.setCombatMessage(bossHud.telegraphLocked);
      }
      this.bossTelegraphById.set(boss.id, telegraphActive);
      const bossShots = tickRaycastBossVolleys(boss, bossPlayerCtx, this.time.now, this.map);
      if (bossShots.length > 0) {
        this.enemyProjectiles.push(...bossShots);
        this.setCombatMessage(bossHud.volleyInbound);
        this.audioFeedback.play('spawn', 0.9, this.time.now);
        this.pulseFeedback(0xff8833, 0.065, 150);
      }
      tickRaycastBossArenaTwist(boss, this.time.now);
    }

    const previousTime = this.time.now - delta;
    const activatedTelegraphs = this.enemies
      .filter((enemy) => didRaycastEnemyFinishTelegraph(enemy, previousTime, this.time.now))
      .map((enemy) => enemy.id);
    const enemyResult = updateRaycastEnemies(
      this.map,
      this.enemies,
      { x: this.player.x, y: this.player.y, alive: this.playerAlive },
      this.time.now,
      delta,
      {
        speedMultiplier:
          (this.activeLevelEvent.effects.enemySpeedMultiplier ?? 1) * (this.runModifier?.effects.enemySpeedMul ?? 1),
        projectileSpeedMultiplier: this.activeLevelEvent.effects.enemyProjectileSpeedMultiplier ?? 1
      }
    );
    if (enemyResult.flashActivations.length > 0) {
      const baseDuration = enemyResult.flashActivations[0].baseDurationMs;
      const duration = getRaycastFlashDurationMs({
        baseMs: baseDuration,
        difficultyId: this.difficultyId,
        directorIntensity: this.directorIntensity,
        event: this.activeLevelEvent
      });
      this.flashBlindUntil = Math.max(this.flashBlindUntil, this.time.now + duration);
      this.setCombatMessage('RÁFAGA CEGADORA // VISIÓN ALTERADA', 900);
      this.pulseFeedback(0xd5b4ff, 0.08, 220);
    }
    if (activatedTelegraphs.length > 0) {
      const materialized = this.enemies.find((enemy) => enemy.id === activatedTelegraphs[0]);
      const identity = materialized ? getRaycastEnemyIdentity(materialized.kind) : null;
      this.audioFeedback.play('spawn', 0.84, this.time.now, {
        pitchMul: identity?.spawnAudioPitchMul ?? 1
      });
      this.pulseFeedback(identity?.telegraphColor ?? 0xffb347, 0.04, 120);
      this.setCombatMessage(activatedTelegraphs.length > 1 ? 'HOSTILES MATERIALIZADOS' : 'BRECHA HOSTIL ABIERTA');
    }
    if (enemyResult.spawnedProjectiles.length > 0) {
      this.enemyProjectiles.push(...enemyResult.spawnedProjectiles);
      this.setCombatMessage('PAQUETE HOSTIL ENTRANTE');
      this.audioFeedback.play('spawn', 0.92, this.time.now);
      this.pulseFeedback(0xff5b6f, 0.04, 120);
    }
    if (enemyResult.meleeDamage > 0) this.damagePlayer(enemyResult.meleeDamage);
    this.applyExploderBursts();

    const projectileDamage = updateRaycastEnemyProjectiles(
      this.map,
      this.enemyProjectiles,
      { x: this.player.x, y: this.player.y, alive: this.playerAlive },
      this.time.now,
      delta
    );
    if (projectileDamage > 0) this.damagePlayer(projectileDamage);
    this.enemyProjectiles = this.enemyProjectiles.filter((projectile) => projectile.alive);
    tickDualBossCoordination(this.getLiveBosses(), bossPlayerCtx, this.time.now);
  }

  private trySpawnBossAdds(liveBosses: RaycastBossState[]): void {
    if (liveBosses.length <= 0 || !this.playerAlive || this.levelComplete) return;
    if (this.time.now < this.nextBossAddSpawnAt) return;
    const alive = this.countLivingEnemies();
    const targetCap = this.difficultyId === 'assist' ? 4 : this.difficultyId === 'hard' ? 10 : 7;
    if (alive >= targetCap) {
      this.nextBossAddSpawnAt = this.time.now + 1600;
      return;
    }
    const spawnPoints = getSafeDirectorSpawnPoints(this.currentLevel, this.player, this.activeZoneId, {
      map: this.map,
      enemies: this.enemies
    });
    if (spawnPoints.length === 0) return;
    const kinds: EnemyKind[] = this.difficultyId === 'assist' ? ['GRUNT'] : this.difficultyId === 'hard' ? ['GRUNT', 'STALKER', 'RANGED'] : ['GRUNT', 'STALKER'];
    const kind = kinds[Math.floor((this.time.now / 97) % kinds.length)];
    for (const point of spawnPoints) {
      if (!isRaycastSpawnPlacementValid(this.map, point, 0.4, 0.04)) continue;
      const spawn = { id: `boss-add-${Math.floor(this.time.now)}-${this.enemies.length}`, kind, x: point.x, y: point.y };
      this.enemies.push(createTelegraphedRaycastEnemy(spawn, { telegraphStartedAt: this.time.now, telegraphDurationMs: DIRECTOR_SPAWN_TELEGRAPH_MS }));
      this.nextBossAddSpawnAt = this.time.now + (this.difficultyId === 'hard' ? 3200 : this.difficultyId === 'assist' ? 5600 : 4300);
      return;
    }
    this.nextBossAddSpawnAt = this.time.now + 1800;
  }

  private damagePlayer(amount: number): void {
    if (!this.playerAlive || this.levelComplete) return;
    const previousHealth = this.playerHealth;
    const incoming = Math.max(0, amount) * (this.runModifier?.effects.enemyDamageMul ?? 1);
    const appliedDamage = scaleRaycastIncomingDamage(incoming, this.difficultyId);
    this.playerHealth = Math.max(0, this.playerHealth - appliedDamage);
    this.damageTaken += appliedDamage;
    if (this.getLiveBosses().length > 0) {
      this.runBossDamageTaken += appliedDamage;
    }
    this.lastPlayerDamageAt = this.time.now;
    this.passiveHealFractionalCarry = 0;
    const shakeDur = Phaser.Math.Clamp(88 + appliedDamage * 2.4, 96, 168);
    const shakeMag = Phaser.Math.Clamp(0.00275 + appliedDamage * 0.000065, 0.00275, 0.0045);
    this.cameras.main.shake(shakeDur, shakeMag);
    this.flashDamage(appliedDamage);
    this.gamepadInput?.vibrate('damage');
    let damageIntensity = Phaser.Math.Clamp(0.58 + appliedDamage * 0.019, 0.58, 1.05);
    if (this.getLiveBosses().length > 0) damageIntensity = Math.min(1.08, damageIntensity + 0.065);
    if (this.playerHealth > 0) {
      if (this.playerHealth <= 18) damageIntensity = Math.min(1.16, damageIntensity + 0.12);
      else if (this.playerHealth <= 35) damageIntensity = Math.min(1.1, damageIntensity + 0.06);
    }
    this.audioFeedback.play('damage', damageIntensity, this.time.now);
    this.setCombatMessage(`${getRaycastCombatMessageForSegment(this.getWorldSegment(), 'damage')} -${appliedDamage}`);
    if (this.playerHealth === 0) {
      this.playerAlive = false;
      this.deliverPlayerDeathGameMaster();
      this.setCombatMessage('SEÑAL TERMINADA');
      this.cameras.main.shake(200, 0.0042);
      this.pulseFeedback(0xff1a3a, 0.14, 400);
      this.audioFeedback.play('death', 1, this.time.now);
      this.audioFeedback.play('uiDeny', 0.7, this.time.now + 85);
      this.showRunCompleteOverlay('SEÑAL TERMINADA', this.hudCss.warningText, false, true);
      return;
    }
    if (
      shouldPlayRaycastLowHealthWarning({
        previousHealth,
        nextHealth: this.playerHealth,
        nowMs: this.time.now,
        lastWarningAtMs: this.lastLowHealthWarningAt,
        playerAlive: this.playerAlive,
        levelComplete: this.levelComplete
      })
    ) {
      this.lastLowHealthWarningAt = this.time.now;
      this.playFeedbackEvent('lowHealthWarning');
      this.pulseFeedback(this.playerHealth <= 25 ? 0xff5b6f : 0xffb347, 0.04, 120);
      this.setCombatMessage(buildRaycastLowHealthWarningMessage(this.playerHealth));
      this.emitGameMasterNarration('low_health');
    }
  }

  private updateLevelState(): void {
    const previousZoneId = this.activeZoneId;
    this.activeZoneId = findRaycastZoneId(this.currentLevel, this.player.x, this.player.y);
    if (this.activeZoneId && this.activeZoneId !== previousZoneId) {
      this.tryTriggerEncounterBeat((beat) => beat.zoneId === this.activeZoneId);
    }

    this.currentLevel.keys.forEach((key) => {
      if (!this.keySystem.hasKey(key.id) && isNearPoint(this.player.x, this.player.y, key)) {
        this.keySystem.collect(key);
        this.blockedHintReason = null;
        const tokenBonus = this.runModifier?.effects.tokenScoreBonus ?? 0;
        if (tokenBonus > 0) this.runScore += tokenBonus;
        this.audioFeedback.play('pickupKey', 1, this.time.now);
        this.pulseFeedback(RAYCAST_PALETTE.plasmaBright, 0.09, 140);
        this.cameras.main.shake(55, 0.0014);
        this.pushPickupToast('key');
        this.emitGameMasterNarration(
          'pickup_key',
          { pickupLabel: key.label ?? key.id, pickupKind: 'ficha' },
          key.id,
        );
      }
    });

    this.currentLevel.doors.forEach((door) => {
      if (!this.doorSystem.isOpen(door.id) && isNearPoint(this.player.x, this.player.y, { ...door, radius: 0.78 })) {
        this.tryOpenDoor(door);
      }
    });

    this.currentLevel.triggers.forEach((trigger) => {
      const activated = this.triggerSystem.activateIfEntered(trigger, [{ x: this.player.x, y: this.player.y }], {
        isDoorOpen: (doorId) => this.doorSystem.isOpen(doorId)
      });
      if (!activated) return;

      this.gameDirector.notifyZoneTrigger(trigger.id, this.time.now);
      this.tryTriggerEncounterBeat((beat) => beat.triggerId === trigger.id);
      this.stageSetpieceCue(trigger.setpieceCue);
      this.audioFeedback.play('directorAmbush', 1, this.time.now);
      this.pulseCorruption();
      this.pulseFeedback(0xff5b6f, 0.06, 170);
      this.setCombatMessage(`CORRUPTION BREACH: ${trigger.activationText}`);
      const spawned: RaycastEnemy[] = [];
      const spawnPressure =
        (this.activeLevelEvent.effects.spawnPressureMultiplier ?? 1) * (this.runModifier?.effects.spawnPressureMul ?? 1);
      const triggerSpawnChance = spawnPressure < 1 ? Math.max(0.58, spawnPressure) : 1;
      const triggerRng = createSeededLevelEventRng(`${trigger.id}:${Math.floor(this.time.now / 1000)}`);
      for (let index = 0; index < trigger.spawns.length; index += 1) {
        if (triggerRng() > triggerSpawnChance) continue;
        const spawn = trigger.spawns[index];
        const enemy = this.createTelegraphedSpawnEnemy(
          { id: `${trigger.id}-${index}`, kind: spawn.kind, x: spawn.x, y: spawn.y },
          'encounter'
        );
        if (enemy) spawned.push(this.withVariantApplied(enemy, triggerRng, index));
      }
      this.enemies.push(...spawned);
    });

    this.currentLevel.secrets.forEach((secret) => {
      if (this.collectedSecrets.has(secret.id)) return;
      if (!isNearPoint(this.player.x, this.player.y, secret)) return;
      registerRaycastSecret(this.collectedSecrets, secret);
      const secretBase = addRaycastSecretScore(0);
      const secretBoosted = Math.round(secretBase * (this.runModifier?.effects.secretScoreMul ?? 1));
      this.runScore += this.applyEventScoreGain(secretBoosted);
      this.audioFeedback.play('secret', 1, this.time.now);
      this.pulseFeedback(RAYCAST_PALETTE.plasmaBright, 0.11, 180);
      this.pushPickupToast('secret');
      this.emitGameMasterNarration(
        'secret_found',
        { pickupLabel: secret.billboardLabel ?? secret.id },
        secret.id,
      );
    });

    this.currentLevel.healthPickups.forEach((pickup) => {
      if (this.collectedHealthPickups.has(pickup.id)) return;
      if (!isNearPoint(this.player.x, this.player.y, pickup)) return;

      const result = applyRaycastHealthPickup(
        this.playerHealth,
        getRaycastDifficultyHealthPickup(pickup, this.difficultyId),
        this.playerMaxHealth
      );
      if (!result.consumed) {
        const lastHintAt = this.deferredPickupHints.get(pickup.id) ?? Number.NEGATIVE_INFINITY;
        if (this.time.now - lastHintAt < 1800) return;
        this.deferredPickupHints.set(pickup.id, this.time.now);
        this.playFeedbackEvent('healthPickupDenied');
        this.pulseFeedback(0xffb347, 0.035, 90);
        this.setCombatMessage(pickup.fullHealthMessage);
        return;
      }

      this.playerHealth = result.nextHealth;
      registerRaycastPickup(this.collectedHealthPickups, pickup);
      this.deferredPickupHints.delete(pickup.id);
      this.playFeedbackEvent('healthPickup');
      this.pulseFeedback(0xff8fb0, 0.08, 150);
      this.cameras.main.shake(45, 0.001);
      this.pushPickupToast(mapRaycastHealthPickupToastKind(pickup.kind), result.restored);
      this.emitGameMasterNarration(
        'pickup_health',
        { pickupLabel: pickup.billboardLabel ?? pickup.id, pickupKind: pickup.kind },
        pickup.id,
      );
    });

    this.currentLevel.exits.forEach((exit) => {
      if (this.levelComplete) return;
      if (!isNearPoint(this.player.x, this.player.y, exit)) return;
      const exitAccess = getRaycastExitAccess(this.currentLevel, {
        collectedKeyIds: this.currentLevel.keys.filter((key) => this.keySystem.hasKey(key.id)).map((key) => key.id),
        openDoorIds: this.currentLevel.doors.filter((door) => this.doorSystem.isOpen(door.id)).map((door) => door.id),
        activatedTriggerIds: this.currentLevel.triggers.filter((trigger) => this.triggerSystem.hasActivated(trigger.id)).map((trigger) => trigger.id),
        livingEnemyCount: this.countReachableLivingEnemies(),
        bossDefeated: this.bossStates.length > 0 ? this.getLiveBosses().length === 0 : true
      });
      if (!exitAccess.allowed) {
        this.audioFeedback.play('uiDeny', 1, this.time.now);
        this.pulseFeedback(0xff5b6f, 0.06, 110);
        this.blockedHintReason =
          exitAccess.reason === 'TOKEN_REQUIRED'
            ? 'exit-key'
            : exitAccess.reason === 'TRIGGER_REQUIRED'
              ? 'exit-trigger'
              : exitAccess.reason === 'SIGNAL_LOCKED'
                ? 'exit-combat'
                : 'exit-door';
        this.blockedHintUntil = this.time.now + 2600;
        this.setCombatMessage(exitAccess.message ?? getRaycastCombatMessageForSegment(this.getWorldSegment(), 'locked'));
        return;
      }
      const sectorMetrics = this.collectSectorMetricsSnapshot();
      this.campaignMetrics = mergeCampaignMetrics(this.campaignMetrics, sectorMetrics);
      const clearMul = this.runModifier?.effects.clearBonusMul ?? 1;
      this.runScore += Math.round(this.applyEventScoreGain(addRaycastSectorPerformanceBonus(0, sectorMetrics)) * clearMul);
      if (this.isTerminalArcSector()) {
        this.runScore += Math.round(RAYCAST_FULL_ARC_CLEAR_BONUS * clearMul);
      }
      this.stopGameMasterPresentation('level_complete');
      this.levelComplete = true;
      this.episodeComplete = this.nextLevelId === null;
      this.emitGameMasterNarration(
        'objective_complete',
        { pickupLabel: exit.objectiveText ?? exit.id },
        exit.id,
      );
      const masteryRank = computeRaycastRunMasteryRankParts({
        elapsedMs: this.time.now - this.runStartedAt,
        enemiesKilled: this.enemiesKilled,
        secretsFound: this.collectedSecrets.size,
        secretTotal: this.currentLevel.secrets.length,
        tokensFound: this.getKeyCount(),
        tokenTotal: this.currentLevel.keys.length,
        damageTaken: this.damageTaken,
        bossArenaDamageTaken: this.currentLevel.bossConfig ? this.runBossDamageTaken : undefined,
        pelletsFired: this.runPelletsFired,
        pelletsHitHostile: this.runPelletsHitHostile,
        hadBoss: Boolean(this.currentLevel.bossConfig),
        regenUsed: this.runUsedPassiveRegen,
        deaths: 0,
        retries: 0
      });
      this.runClearedLevelIds.add(this.currentLevel.id);
      this.runRankByLevelId.set(this.currentLevel.id, masteryRank.tierLetter);
      if (this.episodeComplete) {
        const campaignBonus = addRaycastCampaignCompletionBonus(0, this.campaignMetrics);
        const boostedCampaignBonus = applyRunModifierRankBonus(campaignBonus, this.runModifier);
        this.runScore += boostedCampaignBonus;
      }
      const bossContinueWorldTwo =
        Boolean(this.currentLevel.bossConfig) && !this.episodeComplete && this.nextLevelId !== null;

      let overlayTitle = 'NIVEL COMPLETADO';
      if (bossContinueWorldTwo) {
        overlayTitle = 'JEFE DERROTADO';
      } else if (this.episodeComplete && this.isTerminalArcSector()) {
        overlayTitle = 'ARCO COMPLETO LIMPIO';
      } else if (this.episodeComplete && this.currentLevel.bossConfig) {
        overlayTitle = 'JEFE DERROTADO';
      } else if (this.episodeComplete) {
        overlayTitle = 'EPISODIO COMPLETADO';
      }

      this.playFeedbackEvent(this.episodeComplete ? 'episodeComplete' : 'levelComplete');
      this.pulseFeedback(this.episodeComplete ? 0xffc36b : RAYCAST_PALETTE.plasmaBright, this.episodeComplete ? 0.12 : 0.09, 260);
      this.cameras.main.shake(this.episodeComplete ? 180 : 120, this.episodeComplete ? 0.0022 : 0.0017);
      this.setCombatMessage(`${getRaycastExitMessageForSegment(this.getWorldSegment())}: ${exit.objectiveText}`);
      this.showRunCompleteOverlay(overlayTitle, this.hudCss.systemText, this.episodeComplete);
    });
  }

  private collectSectorMetricsSnapshot(): RaycastSectorMetrics {
    return {
      pelletsFired: this.runPelletsFired,
      pelletsHitHostile: this.runPelletsHitHostile,
      damageTaken: this.damageTaken,
      secretsFound: this.collectedSecrets.size,
      secretTotal: this.currentLevel.secrets.length,
      elapsedMs: this.time.now - this.runStartedAt,
      enemiesKilled: this.enemiesKilled,
      bossPelletsFired: this.runBossPelletsFired,
      bossPelletsHitHostile: this.runBossPelletsHitHostile,
      bossDamageTaken: this.runBossDamageTaken,
      hadBoss: Boolean(this.currentLevel.bossConfig)
    };
  }

  private static dedupeMedalList(ids: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  }

  private showRunCompleteOverlay(
    title: string,
    titleColor: string,
    episodeComplete = false,
    isDeath = false
  ): void {
    appendRaycastPlaytestTelemetry({
      timestampIso: new Date().toISOString(),
      levelId: this.currentLevel.id,
      levelName: this.currentLevel.name,
      worldSegment: this.getWorldSegment(),
      difficulty: getRaycastDifficultyPreset(this.difficultyId).label,
      outcome: isDeath ? 'death' : 'clear',
      elapsedMs: this.time.now - this.runStartedAt,
      score: this.runScore,
      enemiesKilled: this.enemiesKilled,
      damageTaken: this.damageTaken,
      secretsFound: this.collectedSecrets.size,
      secretTotal: this.currentLevel.secrets.length,
      tokensFound: this.getKeyCount(),
      tokenTotal: this.currentLevel.keys.length,
      pelletsFired: this.runPelletsFired,
      pelletsHitHostile: this.runPelletsHitHostile,
      bossPelletsFired: this.runBossPelletsFired,
      bossPelletsHitHostile: this.runBossPelletsHitHostile,
      bossDamageTaken: this.runBossDamageTaken,
      campaign: episodeComplete ? this.campaignMetrics : undefined
    });
    const runRank = this.runRankByLevelId.get(this.currentLevel.id) ?? 'C';
    getSaveManager().recordRunOutcome({
      levelId: this.currentLevel.id,
      difficultyId: this.difficultyId,
      outcome: isDeath ? 'death' : 'clear',
      elapsedMs: this.time.now - this.runStartedAt,
      score: this.runScore,
      rank: runRank,
      pelletsFired: this.runPelletsFired,
      pelletsHitHostile: this.runPelletsHitHostile,
      enemiesKilled: this.enemiesKilled,
      secretsFound: this.collectedSecrets.size
    });
    writeRaycastHighScoreIfBetter(this.runScore);
    const highScore = readRaycastHighScore();
    const episodeState = getRaycastEpisodeState(this.currentLevel.id);
    const worldTwoIndex = RAYCAST_WORLD_TWO_CATALOG.findIndex((entry) => entry.id === this.currentLevel.id);
    const worldThreeIndex = RAYCAST_WORLD_THREE_CATALOG.findIndex((entry) => entry.id === this.currentLevel.id);
    const fullArcClear = episodeComplete && this.isTerminalArcSector();
    let masteryUnlockedNow = false;
    if (!isDeath && episodeComplete && fullArcClear) {
      const evaluation = evaluateRaycastMasteryEnding({
        terminalArcCleared: true,
        clearedLevelIds: [...this.runClearedLevelIds],
        levelRankById: Object.fromEntries(this.runRankByLevelId.entries())
      });
      const nextUnlock = applyRaycastMasteryUnlock(evaluation, this.masteryUnlockState, new Date().toISOString());
      masteryUnlockedNow = !this.masteryUnlockState.trueSignalUnlocked && nextUnlock.trueSignalUnlocked;
      this.masteryUnlockState = nextUnlock;
      writeRaycastMasteryUnlockState(this.masteryUnlockState);
    }
    const sectorMetrics = this.collectSectorMetricsSnapshot();
    const medals = !isDeath
      ? RaycastScene.dedupeMedalList([
          ...(episodeComplete ? computeRaycastCampaignMedals(this.campaignMetrics) : []),
          ...computeRaycastSectorMedals(sectorMetrics)
        ])
      : [];

    const summary = buildRaycastRunSummary({
      difficultyLabel: getRaycastDifficultyPreset(this.difficultyId).label,
      elapsedMs: this.time.now - this.runStartedAt,
      enemiesKilled: this.enemiesKilled,
      score: this.runScore,
      highScore,
      secretsFound: this.collectedSecrets.size,
      secretTotal: this.currentLevel.secrets.length,
      tokensFound: this.getKeyCount(),
      tokenTotal: this.currentLevel.keys.length,
      damageTaken: this.damageTaken,
      bossArenaDamageTaken: this.currentLevel.bossConfig ? this.runBossDamageTaken : undefined,
      fullArcClear: !isDeath && fullArcClear,
      pelletsFired: this.runPelletsFired,
      pelletsHitHostile: this.runPelletsHitHostile,
      bossPelletsFired: this.runBossPelletsFired,
      bossPelletsHitHostile: this.runBossPelletsHitHostile,
      hadBoss: Boolean(this.currentLevel.bossConfig),
      medals: medals.length > 0 ? medals : undefined,
      campaign: episodeComplete ? this.campaignMetrics : undefined,
      episodeComplete: !isDeath && episodeComplete,
      regenUsed: this.runUsedPassiveRegen,
      deaths: isDeath ? 1 : 0,
      retries: 0
    });
    const levelLine =
      worldThreeIndex >= 0
        ? `WORLD 3 SECTOR ${worldThreeIndex + 1}/${RAYCAST_WORLD_THREE_CATALOG.length} ${this.currentLevel.name.toUpperCase()}`
        : worldTwoIndex >= 0
          ? `WORLD 2 SECTOR ${worldTwoIndex + 1}/${RAYCAST_WORLD_TWO_CATALOG.length} ${this.currentLevel.name.toUpperCase()}`
          : `SECTOR ${episodeState.currentLevelNumber}/${episodeState.totalLevels} ${this.currentLevel.name.toUpperCase()}`;

    if (isDeath) {
      const overlaySummary = [...buildRaycastDeathOverlaySummary(levelLine), ...summary];
      this.finalTitleText.setText(title).setColor(titleColor);
      this.finalSummaryText.setText(overlaySummary.join('\n'));
      this.finalHintText.setText(buildRaycastDeathOverlayHint());
      this.finalOverlay.setVisible(true).setAlpha(0.9);
      this.finalTitleText.setVisible(true);
      this.finalSummaryText.setVisible(true);
      this.finalHintText.setVisible(true);
      return;
    }

    const finaleBossEpisodeComplete = Boolean(episodeComplete && this.currentLevel.bossConfig);
    const bossContinueWorldThree =
      !episodeComplete &&
      this.nextLevelId === RAYCAST_WORLD_THREE_CATALOG[0]?.id &&
      this.currentLevel.id === RAYCAST_WORLD_TWO_CATALOG[RAYCAST_WORLD_TWO_CATALOG.length - 1]?.id;
    const bossContinueWorldTwo =
      Boolean(this.currentLevel.bossConfig) &&
      !episodeComplete &&
      this.nextLevelId !== null &&
      !bossContinueWorldThree;

    const endingLines = buildRaycastMasteryEndingLines({
      episodeComplete,
      fullArcClear,
      masteryUnlocked: this.masteryUnlockState.trueSignalUnlocked,
      impossibleModeUnlocked: this.masteryUnlockState.impossibleModeUnlocked,
      hiddenChallengeHookUnlocked: this.masteryUnlockState.hiddenFinalChallengeHookUnlocked
    });
    const overlaySummary = [levelLine, ...summary, ...endingLines];
    const hint = buildRaycastOverlayHint({
      currentLevelNumber: episodeState.currentLevelNumber,
      canAdvance: !episodeComplete && this.nextLevelId !== null,
      episodeComplete,
      finaleBossCleared: finaleBossEpisodeComplete || bossContinueWorldTwo || bossContinueWorldThree,
      worldTwoLocked: RAYCAST_WORLD_TWO_CATALOG.length === 0,
      continueToWorldTwo: bossContinueWorldTwo,
      continueToWorldThree: bossContinueWorldThree,
      masteryUnlocked: masteryUnlockedNow || this.masteryUnlockState.trueSignalUnlocked
    });

    this.finalTitleText.setText(title).setColor(titleColor);
    this.finalSummaryText.setText(overlaySummary.join('\n'));
    this.finalHintText.setText(hint);
    this.finalOverlay.setVisible(true).setAlpha(0.82);
    this.finalTitleText.setVisible(true);
    this.finalSummaryText.setVisible(true);
    this.finalHintText.setVisible(true);
  }

  private tryOpenDoor(door: RaycastDoor): void {
    const result = this.doorSystem.attemptOpen(door, 0);
    if (result.reason === 'MISSING_KEY') {
      this.playFeedbackEvent('doorDenied');
      this.pulseFeedback(0xff5b6f, 0.05, 100);
      this.blockedHintReason = 'door-key';
      this.blockedHintUntil = this.time.now + 2600;
      this.setCombatMessage(`TOKEN REQUIRED: ${door.lockedObjectiveText.toUpperCase()}`);
      return;
    }
    if (!result.opened) return;

    openRaycastDoor(this.map, door);
    this.mapLayoutRevision += 1;
    this.minimapStaticCellsCacheKey = '';
    this.minimapStaticCells = null;
    this.blockedHintReason = null;
    this.tryTriggerEncounterBeat((beat) => beat.doorId === door.id);
    this.playFeedbackEvent('doorOpened');
    this.pulseFeedback(RAYCAST_PALETTE.plasmaBright, 0.06, 140);
    this.cameras.main.shake(70, 0.0014);
    this.setCombatMessage(`${getRaycastCombatMessageForSegment(this.getWorldSegment(), 'doorOpen')}: ${door.openObjectiveText}`);
    this.emitGameMasterNarration(
      'door_opened',
      { pickupLabel: door.openObjectiveText ?? door.id },
      door.id,
    );
  }

  private playFeedbackEvent(event: RaycastFeedbackEvent): void {
    getRaycastFeedbackActions(event).forEach((action) => {
      this.audioFeedback.play(action.cue, action.intensity, this.time.now + (action.delayMs ?? 0));
    });
  }

  private computeBillboardSignature(): string {
    /** Level key/door order is stable — no sort (saves work on every frame before cache hit). */
    const keysHeld = this.currentLevel.keys
      .filter((key) => this.keySystem.hasKey(key.id))
      .map((key) => key.id)
      .join(',');
    const doorsOpen = this.currentLevel.doors
      .filter((door) => this.doorSystem.isOpen(door.id))
      .map((door) => door.id)
      .join(',');
    const secrets = [...this.collectedSecrets].sort().join(',');
    const pickups = [...this.collectedHealthPickups].sort().join(',');
    return `${keysHeld}|${doorsOpen}|${secrets}|${pickups}|${this.levelComplete ? 1 : 0}|${this.getObjectiveHint()}`;
  }

  private refreshBillboardCache(): void {
    const next = this.computeBillboardSignature();
    if (next === this.billboardSig && this.cachedBillboards.length > 0) return;
    this.billboardSig = next;
    this.cachedBillboards = this.buildBillboardsFromState();
  }

  private buildBillboardsFromState(): RaycastBillboard[] {
    const keyBillboards = this.currentLevel.keys
      .filter((key) => !this.keySystem.hasKey(key.id))
      .map((key) => ({
        x: key.x,
        y: key.y,
        color: getBillboardColor('token'),
        radius: key.radius,
        label: key.billboardLabel,
        style: 'token' as const
      }));
    const doorBillboards = this.currentLevel.doors
      .map((door) => ({
        x: door.x,
        y: door.y,
        color: getBillboardColor(this.doorSystem.isOpen(door.id) ? 'gate-open' : 'gate', this.doorSystem.isOpen(door.id)),
        radius: this.doorSystem.isOpen(door.id) ? 0.22 : 0.18,
        label: this.doorSystem.isOpen(door.id) ? 'ABIERTA' : 'BLOQ',
        style: this.doorSystem.isOpen(door.id) ? ('gate-open' as const) : ('gate' as const)
      }));
    const secretBillboards = this.currentLevel.secrets
      .filter((secret) => !this.collectedSecrets.has(secret.id))
      .map((secret) => ({
        x: secret.x,
        y: secret.y,
        color: getBillboardColor('secret'),
        radius: secret.radius,
        label: secret.billboardLabel,
        style: 'secret' as const
      }));
    const healthBillboards = this.currentLevel.healthPickups
      .filter((pickup) => !this.collectedHealthPickups.has(pickup.id))
      .map((pickup) => ({
        x: pickup.x,
        y: pickup.y,
        color: getBillboardColor('health'),
        radius: pickup.radius,
        label: pickup.billboardLabel,
        style: 'health' as const
      }));
    const exitBillboards = this.currentLevel.exits.map((exit) => ({
      x: exit.x,
      y: exit.y,
      color: getBillboardColor('exit', this.levelComplete),
      radius: exit.radius,
      label: this.getObjectiveHint() === 'LLEGA A LA SALIDA' || this.levelComplete ? 'PORTAL' : exit.billboardLabel,
      style: 'exit' as const
    }));

    return [...keyBillboards, ...doorBillboards, ...secretBillboards, ...healthBillboards, ...exitBillboards];
  }

  private renderMinimapThrottled(): void {
    if (!this.minimapVisible) {
      return;
    }
    if (!this.gamePaused) {
      this.minimapFrameCounter += 1;
      const pixelation = this.activeLevelEvent.effects.minimapPixelation ?? 0;
      const qualityStride = getMinimapStrideForMinimapQuality(getMinimapQuality(this.registry));
      const stride = getEffectiveMinimapStride(
        Math.max(qualityStride, pixelation >= 0.5 ? 4 : pixelation > 0 ? 3 : 2),
        this.adaptiveQuality.minimapStrideBoost,
      );
      if (this.minimapFrameCounter % stride !== 0) {
        return;
      }
    }
    this.renderMinimap();
  }

  private updatePlayerMetrics(delta: number): void {
    const movement = Math.hypot(this.player.x - this.lastPlayerPosition.x, this.player.y - this.lastPlayerPosition.y);
    this.playerStationaryMs = movement < 0.01 ? this.playerStationaryMs + delta : 0;
    this.lastPlayerPosition.x = this.player.x;
    this.lastPlayerPosition.y = this.player.y;
  }

  private updateGameDirector(): void {
    if (!this.currentLevel.director.enabled) return;

    const safePoints = getSafeDirectorSpawnPoints(this.currentLevel, this.player, this.activeZoneId, {
      map: this.map,
      enemies: this.enemies,
      allowVisibleFrontSpawns: false
    });

    const zoneRule = selectRaycastEncounterPatternBinding(
      this.currentLevel,
      this.activeZoneId,
      this.lastDirectorState ?? 'CALM',
      this.time.now,
      this.playerHealth,
      this.encounterPatternCooldownUntil
    );
    const patternRule = this.pickBossEncounterPatternRule() ?? zoneRule;

    let encounterPattern: {
      patternId: EncounterPatternId;
      bindingId?: string;
      cooldownMs?: number;
      spawns: SpawnRequest[];
    } | null = null;
    if (patternRule && safePoints.length >= 1) {
      const kinds = getEncounterPatternKinds(patternRule.patternId);
      const spawns = buildEncounterPatternSpawns(patternRule.patternId, kinds, safePoints, this.player);
      if (spawns.length >= 1) {
        encounterPattern = {
          patternId: patternRule.patternId,
          bindingId: patternRule.id,
          cooldownMs: patternRule.cooldownMs,
          spawns
        };
      }
    }

    const decision = this.gameDirector.update({
      elapsedTime: this.time.now,
      totalKills: this.enemiesKilled,
      enemiesAlive: this.countLivingEnemies(),
      p1Health: this.playerHealth,
      p2Health: this.playerHealth,
      p1Alive: this.playerAlive,
      p2Alive: this.playerAlive,
      currentWave: this.getActivatedTriggerCount() + 1,
      timeSincePlayerDamagedMs: Math.max(0, this.time.now - this.lastPlayerDamageAt),
      playerStationaryMs: this.playerStationaryMs,
      equippedWeapons: [this.combat.getCurrentWeapon()],
      activeZoneId: this.activeZoneId,
      activatedTriggerCount: this.getActivatedTriggerCount(),
      distanceToImportantPickup: this.getDistanceToImportantPickup(),
      spawnPoints: safePoints,
      aliveEnemyKindCounts: this.countLivingEnemyKinds(),
      encounterPattern
    });

    const previousState = this.lastDirectorState;
    this.directorIntensity = decision.intensity;
    this.directorDebug = decision.debug;
    this.lastDirectorState = decision.state;
    this.announceDirectorStateChange(previousState, decision.state);
    this.handleDirectorEvents(decision.events, decision.spawn, decision.extraSpawns);
  }

  private pickBossEncounterPatternRule(): RaycastEncounterPatternBinding | null {
    const boss = this.getLiveBosses().find((entry) => entry.arenaTwist === 'lateral_lane');
    if (!boss) return null;
    if (this.time.now >= boss.arenaTwistUntil) return null;
    if (this.playerHealth <= 28) return null;
    if (this.lastDirectorState !== 'PRESSURE' && this.lastDirectorState !== 'AMBUSH') return null;
    const id = 'boss-lateral-lane';
    if (this.time.now < (this.encounterPatternCooldownUntil.get(id) ?? 0)) return null;
    return buildSyntheticBossLateralBinding(11_000);
  }

  private handleDirectorEvents(events: DirectorEvent[], spawn: SpawnRequest | null, extraSpawns: SpawnRequest[]): void {
    let spawnedFromEvent = false;

    events.forEach((event) => {
      const audioPlan = getDirectorEventAudioPlan(event.type);
      if (event.type === 'AMBIENT_PULSE') {
        this.audioFeedback.play(audioPlan.cue, audioPlan.intensity, this.time.now);
        return;
      }

      if (event.type === 'WARNING_MESSAGE') {
        this.audioFeedback.play(audioPlan.cue, audioPlan.intensity, this.time.now);
        this.pulseFeedback(0xff5b6f, 0.045, 130);
        this.pulseCorruption();
        this.setCombatMessage(event.message);
        return;
      }

      if (event.type === 'PREPARE_AMBUSH') {
        this.audioFeedback.play(audioPlan.cue, audioPlan.intensity, this.time.now);
        this.pulseFeedback(0xff5b6f, 0.065, 180);
        this.pulseCorruption();
        this.setCombatMessage(event.message);
        return;
      }

      if (event.type === 'RECOVERY_SIGNAL') {
        this.audioFeedback.play(audioPlan.cue, audioPlan.intensity, this.time.now);
        this.pulseFeedback(RAYCAST_PALETTE.plasmaBright, 0.05, 150);
        this.setCombatMessage(event.message);
        return;
      }

      if (event.type === 'PUNISH_STATIONARY') {
        this.audioFeedback.play(audioPlan.cue, audioPlan.intensity, this.time.now);
        this.pulseFeedback(0xff5b6f, 0.07, 130);
        this.pulseCorruption();
        this.setCombatMessage(event.message);
        return;
      }

      if (event.type === 'ENCOUNTER_PATTERN') {
        this.audioFeedback.play(audioPlan.cue, audioPlan.intensity, this.time.now);
        this.pulseFeedback(0xff3358, 0.06, 155);
        if (event.bindingId !== undefined && event.patternCooldownMs !== undefined) {
          this.encounterPatternCooldownUntil.set(event.bindingId, this.time.now + event.patternCooldownMs);
        }
        this.setCombatMessage(event.message);
        return;
      }

      if (event.type === 'SPAWN_PRESSURE' && spawn) {
        spawnedFromEvent = true;
        this.spawnDirectorEnemy(spawn);
      }
    });

    if (spawn && !spawnedFromEvent) this.spawnDirectorEnemy(this.balanceDirectorSpawn(spawn));
    extraSpawns.forEach((req) => this.spawnDirectorEnemy(this.balanceDirectorSpawn(req)));
  }

  private balanceDirectorSpawn(spawn: SpawnRequest): SpawnRequest {
    const rng = createSeededLevelEventRng(`${spawn.kind}:${this.time.now}:${this.directorSpawnCounter}`);
    const kind = adjustDirectorSpawnKind(spawn.kind, countAliveByKind(this.enemies), rng);
    return kind === spawn.kind ? spawn : { ...spawn, kind };
  }

  private announceDirectorStateChange(previousState: DirectorState | null, nextState: DirectorState): void {
    if (previousState === null || previousState === nextState) return;
    if (nextState === 'WARNING') this.setCombatMessage(getRaycastCombatMessageForSegment(this.getWorldSegment(), 'pressure'));
    if (nextState === 'PRESSURE' || nextState === 'AMBUSH')
      this.setCombatMessage(getRaycastCombatMessageForSegment(this.getWorldSegment(), 'surge'));
    if (nextState === 'RECOVERY') {
      const triggered = this.tryTriggerEncounterBeat((beat) => beat.directorState === 'RECOVERY');
      if (!triggered) this.setCombatMessage(getRaycastCombatMessageForSegment(this.getWorldSegment(), 'recovery'));
      this.emitGameMasterNarration('wave_clear');
    }
  }

  private spawnDirectorEnemy(spawn: SpawnRequest): void {
    const spawnPressure =
      (this.activeLevelEvent.effects.spawnPressureMultiplier ?? 1) * (this.runModifier?.effects.spawnPressureMul ?? 1);
    const chance = spawnPressure < 1 ? Math.max(0.6, spawnPressure) : 1;
    if (chance < 1) {
      const rng = createSeededLevelEventRng(`${spawn.x}:${spawn.y}:${this.time.now}:${spawn.kind}`);
      if (rng() > chance) return;
    }
    const enemy = this.createTelegraphedSpawnEnemy(
      {
        id: `director-${this.directorSpawnCounter}`,
        kind: spawn.kind,
        x: spawn.x,
        y: spawn.y
      },
      'director'
    );
    if (!enemy) return;
    const rng = createSeededLevelEventRng(`${spawn.kind}:${spawn.x}:${spawn.y}:${this.time.now}`);
    const staged = this.withVariantApplied(enemy, rng, this.directorSpawnCounter);
    if (spawnPressure > 1) staged.speedMultiplier = (staged.speedMultiplier ?? 1) * Math.min(1.2, spawnPressure);
    const identity = getRaycastEnemyIdentity(staged.kind);
    if (staged.variant === 'ELITE') {
      staged.damageMultiplier =
        (staged.damageMultiplier ?? 1) * (this.activeLevelEvent.effects.eliteDamageMultiplier ?? 1);
      const eliteHealthMul = this.activeLevelEvent.effects.eliteHealthMultiplier ?? 1;
      staged.maxHealth = Math.max(1, Math.round(staged.maxHealth * eliteHealthMul));
      staged.health = staged.maxHealth;
    } else if (staged.kind === 'BRUTE' || staged.kind === 'RANGED' || staged.kind === 'SCRAMBLER') {
      staged.damageMultiplier = (staged.damageMultiplier ?? 1) * (this.activeLevelEvent.effects.eliteDamageMultiplier ?? 1);
      const eliteHealthMul = this.activeLevelEvent.effects.eliteHealthMultiplier ?? 1;
      if (eliteHealthMul > 1) {
        staged.maxHealth = Math.max(1, Math.round(staged.maxHealth * eliteHealthMul));
        staged.health = staged.maxHealth;
      }
    }
    this.enemies.push(staged);
    this.directorSpawnCounter += 1;
    this.audioFeedback.play('directorAmbush', 1, this.time.now, { pitchMul: identity.spawnAudioPitchMul * 0.98 });
    this.pulseCorruption();
    this.pulseFeedback(identity.telegraphColor, 0.06, 160);
    if (staged.variant === 'ELITE' && staged.eliteDisplayName) {
      this.setCombatMessage(`ELITE SIGNAL: ${staged.eliteDisplayName} // ${identity.roleTitle}`, 2400);
    } else {
      this.setCombatMessage(`HOSTILE: ${formatRaycastEnemyIdentityLabel(staged)}`, 1200);
    }
  }

  private createTelegraphedSpawnEnemy(
    spawn: { id: string; kind: SpawnRequest['kind']; x: number; y: number },
    source: 'director' | 'encounter'
  ): RaycastEnemy | null {
    const safe = this.resolveSafeSpawnPoint(spawn);
    if (!safe) return null;
    const visibleToPlayer = this.hasLineOfSightToPoint(safe.x, safe.y);
    const distanceToPlayer = Math.hypot(safe.x - this.player.x, safe.y - this.player.y);
    const baseDuration = source === 'director' ? DIRECTOR_SPAWN_TELEGRAPH_MS : ENCOUNTER_SPAWN_TELEGRAPH_MS;
    const telegraphDurationMs = getRaycastSpawnTelegraphMs({
      baseMs: baseDuration,
      kind: spawn.kind,
      visibleToPlayer,
      distanceToPlayer
    });

    return createTelegraphedRaycastEnemy({ ...spawn, x: safe.x, y: safe.y }, {
      telegraphStartedAt: this.time.now,
      telegraphDurationMs
    });
  }

  private resolveSafeSpawnPoint(spawn: { x: number; y: number; kind: EnemyKind }): { x: number; y: number } | null {
    const radius = Math.max(0.2, getEnemyConfig(spawn.kind, 'raycast').size / 100);
    const isClear = (x: number, y: number): boolean => {
      if (!isRaycastMapPointReachable(this.map, this.player, { x, y })) return false;
      if (!isRaycastSpawnPlacementValid(this.map, { x, y }, radius)) return false;
      if (Math.hypot(x - this.player.x, y - this.player.y) < 0.72) return false;
      for (let i = 0; i < this.enemies.length; i += 1) {
        const enemy = this.enemies[i];
        if (!enemy.alive) continue;
        if (Math.hypot(x - enemy.x, y - enemy.y) < radius + enemy.radius + 0.16) return false;
      }
      return true;
    };
    if (isClear(spawn.x, spawn.y)) return { x: spawn.x, y: spawn.y };

    const probeStep = 0.45;
    for (let ring = 1; ring <= 3; ring += 1) {
      const r = ring * probeStep;
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        const nx = spawn.x + Math.cos(a) * r;
        const ny = spawn.y + Math.sin(a) * r;
        if (isClear(nx, ny)) return { x: nx, y: ny };
      }
    }
    return null;
  }

  private hasLineOfSightToPoint(x: number, y: number): boolean {
    const angle = Math.atan2(y - this.player.y, x - this.player.x);
    const distance = Math.hypot(x - this.player.x, y - this.player.y);
    const hit = castRay(this.map, this.player.x, this.player.y, angle, angle);
    return hit.distance + 0.08 >= distance;
  }

  private getActivatedTriggerCount(): number {
    return this.currentLevel.triggers.filter((trigger) => this.triggerSystem.hasActivated(trigger.id)).length;
  }

  private getDistanceToImportantPickup(): number | null {
    const uncollectedKeyDistances = this.currentLevel.keys
      .filter((key) => !this.keySystem.hasKey(key.id))
      .map((key) => Math.hypot(key.x - this.player.x, key.y - this.player.y));
    const healthPickupDistances =
      this.playerHealth <= RAYCAST_LOW_HEALTH_HINT_THRESHOLD
        ? this.currentLevel.healthPickups
            .filter((pickup) => !this.collectedHealthPickups.has(pickup.id))
            .filter((pickup) => {
              const requiredDoors = pickup.requiredOpenDoorIds ?? [];
              return requiredDoors.every((doorId) => this.doorSystem.isOpen(doorId));
            })
            .map((pickup) => Math.hypot(pickup.x - this.player.x, pickup.y - this.player.y))
        : [];
    const allDistances = [...uncollectedKeyDistances, ...healthPickupDistances];
    return allDistances.length > 0 ? Math.min(...allDistances) : null;
  }

  private isWorldTwoBreachFromBossClear(): boolean {
    return (
      this.levelComplete &&
      Boolean(this.currentLevel.bossConfig) &&
      this.nextLevelId === RAYCAST_WORLD_TWO_CATALOG[0]?.id
    );
  }

  private getCurrentStatusMessage(): string {
    if (this.time.now < this.combatMessageUntil) return this.lastCombatMessage;
    return buildRaycastStatusMessage(
      this.levelComplete,
      this.episodeComplete,
      this.playerAlive,
      Boolean(this.levelComplete && this.currentLevel.bossConfig),
      RAYCAST_WORLD_TWO_CATALOG.length === 0,
      Boolean(this.levelComplete && this.episodeComplete && this.isTerminalArcSector()),
      this.isWorldTwoBreachFromBossClear()
    );
  }

  private buildLevelStartObjectiveMessage(): string {
    const state = this.getObjectiveState();
    return buildRaycastLevelStartObjectiveMessage({
      objective: buildRaycastCurrentObjective(state),
      hasBoss: Boolean(this.currentLevel.bossConfig),
      keyTotal: this.currentLevel.keys.length,
      livingEnemyCount: state.livingEnemyCount
    });
  }

  private getEventAwareObjectiveText(base: string): string {
    const jam = this.activeLevelEvent.effects.hudSignalJitter ?? 0;
    if (jam <= 0) return base;
    if (this.time.now >= this.nextHudJamAt || this.hudObjectiveJamText === null) {
      const jitter = Math.floor(this.time.now / 250) % 3 === 0 ? '...' : '';
      this.hudObjectiveJamText = `${base}${jitter}`;
      this.nextHudJamAt = this.time.now + 350;
    }
    return this.hudObjectiveJamText;
  }

  private getEventAwareHintText(base: string): string {
    const jam = this.activeLevelEvent.effects.hudSignalJitter ?? 0;
    if (jam <= 0) return base;
    if (this.time.now >= this.nextHudJamAt || this.hudHintJamText === null) {
      const jitter = Math.floor(this.time.now / 310) % 4 === 0 ? ' // SIGNAL NOISE' : '';
      this.hudHintJamText = `${base}${jitter}`;
    }
    return this.hudHintJamText;
  }

  private updatePriorityMessage(objective: string, hint: string, blockedHintActive: boolean): void {
    if (
      shouldSuppressRaycastCenterHudBanner({
        playerAlive: this.playerAlive,
        levelComplete: this.levelComplete,
        gamePaused: this.gamePaused,
        endScreenVisible: this.finalOverlay.visible
      })
    ) {
      this.systemText.setText('').setVisible(false);
      return;
    }
    this.systemText.setVisible(true);
    const lowHealthHint = buildRaycastLowHealthHint(this.getNearestAvailableHealthPickupDistance(), this.playerHealth);
    const message = buildRaycastPriorityMessage({
      levelComplete: this.levelComplete,
      episodeComplete: this.episodeComplete,
      finaleBossCleared: Boolean(this.levelComplete && this.currentLevel.bossConfig),
      worldTwoLocked: RAYCAST_WORLD_TWO_CATALOG.length === 0,
      fullArcClear: Boolean(this.levelComplete && this.episodeComplete && this.isTerminalArcSector()),
      worldTwoTransition: this.isWorldTwoBreachFromBossClear(),
      playerAlive: this.playerAlive,
      playerHealth: this.playerHealth,
      objective,
      hint,
      lowHealthHint,
      combatMessage: this.time.now < this.combatMessageUntil ? this.lastCombatMessage : undefined,
      combatMessageActive: this.time.now < this.combatMessageUntil,
      blockedHintActive
    });
    const color =
      message.tone === 'critical'
        ? this.hudCss.warningText
        : message.tone === 'warning'
          ? palette.accent.warmText
          : this.hudCss.systemText;
    this.systemText.setText(message.text).setColor(color).setAlpha(message.tone === 'routine' ? 0.82 : 1);
  }

  private getDirectorDebugLine(): string {
    if (!this.currentLevel.director.enabled) return 'director off';
    if (!this.directorDebug) return 'director warming up';
    return [
      `AI ${DIRECTOR_STATE_LABELS[this.directorDebug.state]}`,
      `int ${this.directorDebug.intensity}`,
      `alive ${this.directorDebug.enemiesAlive}/${this.directorDebug.maxEnemiesAlive ?? '?'}`,
      `cd ${Math.ceil(this.directorDebug.spawnCooldownRemainingMs / 1000)}s`,
      `budget ${this.directorDebug.spawnBudgetRemaining ?? '?'}`,
      `camp ${Math.ceil((this.directorDebug.antiCampMeterMs ?? 0) / 100) / 10}s`,
      this.directorDebug.lastDecisionReason
    ].join(' | ');
  }

  private getWorldSegment(): RaycastWorldSegmentId {
    return this.currentLevel.worldSegment ?? 'world1';
  }

  private isLastWorldTwoLevel(): boolean {
    if (RAYCAST_WORLD_TWO_CATALOG.length === 0) return false;
    return this.currentLevel.id === RAYCAST_WORLD_TWO_CATALOG[RAYCAST_WORLD_TWO_CATALOG.length - 1].id;
  }

  private isLastWorldThreeLevel(): boolean {
    if (RAYCAST_WORLD_THREE_CATALOG.length === 0) return false;
    return this.currentLevel.id === RAYCAST_WORLD_THREE_CATALOG[RAYCAST_WORLD_THREE_CATALOG.length - 1].id;
  }

  /** Terminal sector for full-arc scoring — World 3 finale when shipped, else World 2 finale. */
  private isTerminalArcSector(): boolean {
    if (RAYCAST_WORLD_THREE_CATALOG.length > 0) return this.isLastWorldThreeLevel();
    return this.isLastWorldTwoLevel();
  }

  private getAtmosphereOptions() {
    let base = getAtmosphereForDirector(this.directorDebug?.state ?? null, this.directorIntensity);
    base = applyWorldSegmentToAtmosphere(base, this.getWorldSegment());
    const fogMul = (this.activeLevelEvent.effects.fogDensityMultiplier ?? 1) * (this.runModifier?.effects.fogMul ?? 1);
    if (fogMul < 1) {
      base = {
        ...base,
        fogStart: base.fogStart * fogMul,
        fogEnd: Math.max(base.fogStart * fogMul + 2.2, base.fogEnd * fogMul)
      };
    }
    const darknessAdd = this.runModifier?.effects.darknessAdd ?? 0;
    if (darknessAdd > 0) {
      base = {
        ...base,
        ambientDarkness: Math.min(0.52, base.ambientDarkness + darknessAdd)
      };
    }
    if (this.corruptionZone !== null) {
      base = {
        ...base,
        corruptionAlpha: Math.min(0.32, base.corruptionAlpha + 0.08)
      };
    }
    if (this.time.now < this.blackoutPulseUntil) {
      base = {
        ...base,
        ambientDarkness: Math.min(0.45, base.ambientDarkness + 0.12),
        enemyMinVisibility: Math.max(0.56, base.enemyMinVisibility - 0.08)
      };
    }
    if (this.time.now < this.flashBlindUntil) {
      base = {
        ...base,
        pulseAlpha: Math.min(0.35, base.pulseAlpha + 0.11),
        corruptionAlpha: Math.min(0.34, base.corruptionAlpha + 0.09)
      };
    }
    const boss = this.getLiveBosses()[0];
    if (boss?.alive && this.time.now < boss.arenaTwistUntil && boss.arenaTwist === 'ion_veil') {
      return {
        ...base,
        corruptionAlpha: Math.min(0.26, base.corruptionAlpha * 1.14),
        pulseAlpha: Math.min(0.28, base.pulseAlpha * 1.1),
        enemyMinVisibility: Math.max(0.58, base.enemyMinVisibility - 0.035)
      };
    }
    if (boss?.alive && this.time.now < boss.arenaTwistUntil && boss.arenaTwist === 'retreat_cut') {
      return {
        ...base,
        fogStart: base.fogStart * 0.94,
        pulseAlpha: Math.min(0.26, base.pulseAlpha * 1.08)
      };
    }
    return base;
  }

  private getKeyCount(): number {
    return this.currentLevel.keys.filter((key) => this.keySystem.hasKey(key.id)).length;
  }

  private getObjectiveState(): RaycastObjectiveState {
    if (this.blockedHintReason && this.time.now >= this.blockedHintUntil) {
      this.blockedHintReason = null;
    }

    return {
      levelComplete: this.levelComplete,
      keyCount: this.getKeyCount(),
      keyTotal: this.currentLevel.keys.length,
      closedDoorCount: this.currentLevel.doors.filter((door) => !this.doorSystem.isOpen(door.id)).length,
      activatedTriggerCount: this.getActivatedTriggerCount(),
      requiredTriggerCount: this.currentLevel.progression.requiredExitTriggerIds.length,
      livingEnemyCount: this.countReachableLivingEnemies(),
      playerStationaryMs: this.playerStationaryMs,
      recentBlockedReason: this.blockedHintReason
    };
  }

  private getObjectiveHint(): string {
    return buildRaycastCurrentObjective(this.getObjectiveState());
  }

  private ensureMinimapStaticCells(): RaycastMinimapCell[] {
    const key = `${this.currentLevel.id}:${this.mapLayoutRevision}`;
    if (this.minimapStaticCellsCacheKey !== key || !this.minimapStaticCells) {
      this.minimapStaticCells = buildStaticRaycastMinimapCells({ map: this.map, level: this.currentLevel });
      this.minimapStaticCellsCacheKey = key;
    }
    return this.minimapStaticCells;
  }

  private renderMinimap(): void {
    this.minimapGraphics.clear();
    this.minimapMarkerLabels.forEach((label) => label.setVisible(false));
    if (!this.minimapVisible) return;

    const keyIds = this.minimapKeyIdScratch;
    keyIds.length = 0;
    for (let i = 0; i < this.currentLevel.keys.length; i += 1) {
      const key = this.currentLevel.keys[i];
      if (this.keySystem.hasKey(key.id)) keyIds.push(key.id);
    }
    const doorIds = this.minimapDoorIdScratch;
    doorIds.length = 0;
    for (let i = 0; i < this.currentLevel.doors.length; i += 1) {
      const door = this.currentLevel.doors[i];
      if (this.doorSystem.isOpen(door.id)) doorIds.push(door.id);
    }
    const blips = this.minimapEnemyBlipScratch;
    blips.length = 0;
    for (let i = 0; i < this.enemies.length; i += 1) {
      const enemy = this.enemies[i];
      if (!enemy.alive) continue;
      blips.push({ id: enemy.id, kind: enemy.kind, x: enemy.x, y: enemy.y });
    }
    this.getLiveBosses().forEach((boss) => {
      blips.push({ id: boss.id, kind: 'BRUTE', x: boss.x, y: boss.y, isBoss: true });
    });
    const hazardMarkers = this.minimapHazardMarkerScratch;
    hazardMarkers.length = 0;
    if (this.bossHazards) {
      const markers = getRaycastBossHazardMarkers(this.bossHazards, this.time.now, this.getLiveBosses().length > 0);
      markers.forEach((marker) => hazardMarkers.push(marker));
    }

    const model = buildRaycastMinimapModel({
      map: this.map,
      level: this.currentLevel,
      player: this.player,
      collectedKeyIds: keyIds,
      openDoorIds: doorIds,
      collectedSecretIds: this.collectedSecrets,
      hazardMarkers,
      enemies: blips,
      staticCells: this.ensureMinimapStaticCells()
    });
    const hudLayout = buildRaycastHudLayout(GAME_WIDTH, GAME_HEIGHT);
    const panelWidth = hudLayout.minimapPanelWidth;
    const panelHeight = hudLayout.minimapPanelHeight;
    const originX = hudLayout.minimapPanelX;
    const originY = hudLayout.minimapPanelY;
    const pixelation = this.activeLevelEvent.effects.minimapPixelation ?? 0;
    const tileSizeBase = Math.max(5, Math.floor(Math.min(panelWidth / model.width, panelHeight / model.height)));
    const tileSize = pixelation >= 0.5 ? Math.max(4, tileSizeBase - 2) : pixelation > 0 ? Math.max(4, tileSizeBase - 1) : tileSizeBase;
    const offsetX = originX + Math.floor((panelWidth - model.width * tileSize) / 2);
    const offsetY = originY + Math.floor((panelHeight - model.height * tileSize) / 2);

    model.cells.forEach((cell) => {
      const color = cell.kind === 'wall' ? 0x8aa0b3 : cell.kind === 'door' ? 0xffd268 : 0x143424;
      const alpha = cell.kind === 'floor' ? (pixelation >= 0.5 ? 0.7 : 0.94) : 1;
      this.minimapGraphics.fillStyle(color, alpha);
      this.minimapGraphics.fillRect(offsetX + cell.x * tileSize, offsetY + cell.y * tileSize, tileSize - 1, tileSize - 1);
    });

    for (let mi = 0; mi < model.markers.length; mi += 1) {
      const marker = model.markers[mi];
      if (!marker.active || marker.kind === 'player') continue;
      const px = offsetX + marker.x * tileSize;
      const py = offsetY + marker.y * tileSize;
      const color =
        marker.kind === 'key'
          ? RAYCAST_PALETTE.plasmaBright
          : marker.kind === 'exit'
            ? 0x6fd8ff
            : marker.kind === 'landmark'
              ? 0xffde8a
              : marker.kind === 'hazard'
                ? 0xff6ad6
              : 0xffb347;
      this.minimapGraphics.fillStyle(color, 1);
      this.minimapGraphics.fillRect(px - 3, py - 3, Math.max(6, tileSize - 1), Math.max(6, tileSize - 1));
      this.minimapGraphics.lineStyle(1, 0x04070c, 0.95);
      this.minimapGraphics.strokeRect(px - 3, py - 3, Math.max(6, tileSize - 1), Math.max(6, tileSize - 1));
      if (marker.kind === 'exit') {
        this.minimapGraphics.lineStyle(2, 0xe2f7ff, 1);
        this.minimapGraphics.strokeCircle(px + tileSize * 0.1, py + tileSize * 0.1, Math.max(5, tileSize * 0.55));
      }
    }

    model.enemyBlips.forEach((enemy) => {
      const px = offsetX + enemy.x * tileSize;
      const py = offsetY + enemy.y * tileSize;
      if (enemy.isBoss) {
        const r = Math.max(4, tileSize * 0.5);
        this.minimapGraphics.lineStyle(2, 0x1d0206, 1);
        this.minimapGraphics.strokeCircle(px, py, r + 2);
        this.minimapGraphics.fillStyle(0xff2c3f, 1);
        this.minimapGraphics.fillCircle(px, py, r);
        this.minimapGraphics.lineStyle(2, 0xfff2bd, 1);
        this.minimapGraphics.strokeCircle(px, py, r * 0.58);
        return;
      }
      const style = getRaycastMinimapEnemyDotStyle(enemy.kind);
      const baseR = Math.max(1.8, tileSize * 0.22 * style.radiusMul);
      this.minimapGraphics.lineStyle(1, style.ring, 0.88);
      this.minimapGraphics.strokeCircle(px, py, baseR + 1.1);
      this.minimapGraphics.fillStyle(style.fill, 1);
      if (enemy.kind === 'STALKER') {
        const s = baseR * 1.25;
        this.minimapGraphics.fillTriangle(px, py - s, px - s * 0.92, py + s * 0.62, px + s * 0.92, py + s * 0.62);
      } else if (enemy.kind === 'RANGED') {
        this.minimapGraphics.fillCircle(px, py, baseR);
        this.minimapGraphics.fillStyle(0xfff7fb, 0.55);
        this.minimapGraphics.fillCircle(px, py, Math.max(1, baseR * 0.38));
      } else {
        this.minimapGraphics.fillCircle(px, py, baseR);
      }
    });

    let playerMarker: RaycastMinimapMarker | undefined;
    for (let pi = 0; pi < model.markers.length; pi += 1) {
      const candidate = model.markers[pi];
      if (candidate.kind === 'player' && candidate.active) {
        playerMarker = candidate;
        break;
      }
    }
    if (playerMarker) {
      const px = offsetX + playerMarker.x * tileSize;
      const py = offsetY + playerMarker.y * tileSize;
      const bodyR = Math.max(3.4, tileSize * 0.42);
      this.minimapGraphics.lineStyle(3, 0x05070c, 1);
      this.minimapGraphics.strokeCircle(px, py, bodyR + 2);
      this.minimapGraphics.fillStyle(0xffffff, 1);
      this.minimapGraphics.fillCircle(px, py, bodyR + 0.4);
      this.minimapGraphics.fillStyle(0x58f2e4, 1);
      this.minimapGraphics.fillCircle(px, py, Math.max(1.6, tileSize * 0.14));
      const dirX = Math.cos(playerMarker.angle ?? 0) * tileSize * 1.15;
      const dirY = Math.sin(playerMarker.angle ?? 0) * tileSize * 1.15;
      this.minimapGraphics.lineStyle(4, 0xfff29e, 1);
      this.minimapGraphics.beginPath();
      this.minimapGraphics.moveTo(px, py);
      this.minimapGraphics.lineTo(px + dirX, py + dirY);
      this.minimapGraphics.strokePath();
    }

    const labelScratch = this.minimapLabeledMarkerScratch;
    labelScratch.length = 0;
    for (let li = 0; li < model.markers.length; li += 1) {
      const marker = model.markers[li];
      if (this.shouldRenderMinimapMarkerLabel(marker)) labelScratch.push(marker);
    }
    const maxLabels = pixelation >= 0.5 ? 2 : pixelation > 0 ? 4 : this.minimapMarkerLabels.length;
    const labelLimit = Math.min(labelScratch.length, maxLabels, this.minimapMarkerLabels.length);
    for (let index = 0; index < labelLimit; index += 1) {
      const marker = labelScratch[index];
      const label = this.minimapMarkerLabels[index];
      const markerX = offsetX + marker.x * tileSize;
      const markerY = offsetY + marker.y * tileSize;
      label.setText(marker.label);
      const textX = Phaser.Math.Clamp(markerX + 4, originX + 6, originX + panelWidth - label.width - 4);
      const textY = Phaser.Math.Clamp(markerY - 6, originY + 3, originY + panelHeight - label.height - 3);
      label.setPosition(textX, textY).setVisible(true);
    }
  }

  private shouldRenderMinimapMarkerLabel(marker: { kind: string; label: string; active: boolean }): boolean {
    if (!marker.active) return false;
    if (marker.kind === 'door') return marker.label === 'LOCK' || marker.label === 'OPEN' || marker.label === 'BLOQ' || marker.label === 'ABIERTA';
    if (marker.kind === 'exit') return marker.label === 'EXIT' || marker.label === 'PORTAL';
    if (marker.kind === 'key') return marker.label === 'KEY' || marker.label === 'LLAVE';
    if (marker.kind === 'landmark') return true;
    if (marker.kind === 'hazard') return true;
    return false;
  }

  private updateHealthHud(): void {
    const visual = getRaycastHealthVisualState(this.playerHealth, this.playerMaxHealth);
    this.healthText.setColor(visual.color);
    this.healthBarFill.setFillStyle(visual.accentColor, 1);
    this.healthBarFill.setSize(168 * visual.ratio, 6);
    const pulse =
      visual.tone === 'critical'
        ? 0.76 + Math.sin(this.time.now * 0.0082) * 0.16
        : visual.tone === 'low'
          ? 0.88 + Math.sin(this.time.now * 0.005) * 0.08
          : 1;
    this.healthBarTrack.setAlpha(visual.tone === 'stable' ? 0.9 : pulse);
    if (visual.tone === 'critical') {
      this.healthBarFill.setAlpha(0.86 + Math.sin(this.time.now * 0.0095) * 0.12);
    } else {
      this.healthBarFill.setAlpha(1);
    }
  }

  private updateBossHud(): void {
    const liveBosses = this.getLiveBosses();
    const boss = liveBosses[0] ?? null;
    const bossSecondary = liveBosses[1] ?? null;
    const showBossHud = Boolean(
      this.bossStates.length > 0 &&
      boss &&
      this.playerAlive &&
      !this.levelComplete
    );
    this.bossNameText.setVisible(showBossHud);
    this.bossPhaseText.setVisible(showBossHud);
    this.bossBarTrack.setVisible(showBossHud);
    this.bossBarFill.setVisible(showBossHud);
    this.bossNameTextSecondary.setVisible(showBossHud && bossSecondary !== null);
    this.bossBarTrackSecondary.setVisible(showBossHud && bossSecondary !== null);
    this.bossBarFillSecondary.setVisible(showBossHud && bossSecondary !== null);
    if (!showBossHud || !boss) return;

    const ratio = Phaser.Math.Clamp(boss.maxHealth <= 0 ? 0 : boss.health / boss.maxHealth, 0, 1);
    const telegraphing = this.time.now < boss.telegraphUntil;
    this.bossNameText.setText(`BOSS // ${boss.displayName.toUpperCase()}`);
    this.bossPhaseText
      .setText(`${getRaycastBossPhaseLabel(boss)}  //  ${Math.ceil(ratio * 100)}%`)
      .setColor(telegraphing ? '#ffcf7c' : boss.phase === 3 ? '#ff6a7c' : boss.phase === 2 ? '#ff9ca8' : '#ffe7b8');
    this.bossBarFill
      .setSize(430 * ratio, 10)
      .setFillStyle(telegraphing ? 0xff8833 : boss.phase === 3 ? 0xff3145 : boss.phase === 2 ? 0xff5b6f : 0xb84fff, 1);
    if (bossSecondary) {
      const ratio2 = Phaser.Math.Clamp(
        bossSecondary.maxHealth <= 0 ? 0 : bossSecondary.health / bossSecondary.maxHealth,
        0,
        1
      );
      this.bossNameTextSecondary.setText(`JEFE 2 // ${bossSecondary.displayName.toUpperCase()} ${Math.ceil(ratio2 * 100)}%`);
      this.bossBarFillSecondary.setSize(430 * ratio2, 6).setFillStyle(bossSecondary.phase === 3 ? 0xff4a2e : 0xff7f3a, 1);
    }
  }

  private updateFocusedEnemyHud(): void {
    const wallDistance = castRay(this.map, this.player.x, this.player.y, this.player.angle, this.player.angle).distance;
    const bossTarget = this.getLiveBosses()
      .map((boss) => getRaycastBossCrosshairTarget(this.player, wallDistance, boss, this.time.now))
      .find((target) => target !== null) ?? null;
    const target =
      bossTarget ??
      getRaycastCrosshairTargetInfo(this.player, this.enemies, wallDistance, this.time.now);
    if (!target) {
      this.targetText.setVisible(false);
      this.targetBarTrack.setVisible(false);
      this.targetBarFill.setVisible(false);
      return;
    }

    const targetColor = target.isTelegraphing ? '#ffd78a' : target.isWindingUp ? '#ff7a92' : '#fff0c2';
    this.targetText
      .setText(
        buildRaycastFocusedEnemyLine({
          label: target.kindLabel,
          health: target.health,
          maxHealth: target.maxHealth,
          isWindingUp: target.isWindingUp,
          isTelegraphing: target.isTelegraphing
        })
      )
      .setColor(targetColor)
      .setVisible(true);
    this.targetBarTrack.setVisible(true);
    this.targetBarFill
      .setVisible(true)
      .setFillStyle(target.isTelegraphing ? 0xffc266 : target.isWindingUp ? 0xff4468 : 0xfff29e, 1);
    this.targetBarFill.setSize(118 * Phaser.Math.Clamp(target.healthRatio, 0, 1), 4);
  }

  private flashDamage(amount: number): void {
    const maxHp = this.playerMaxHealth;
    const ratio = Phaser.Math.Clamp(this.playerHealth / maxHp, 0, 1);
    let stress = 1;
    if (ratio <= 0.25) stress = 1.18 + (0.25 - ratio) * 0.95;
    else if (ratio <= 0.5) stress = 1.04 + (0.5 - ratio) * 0.26;
    const frameAlpha = Phaser.Math.Clamp((0.48 + amount / 17) * stress, 0.48, 0.96);
    const flashAlpha = Phaser.Math.Clamp((0.2 + amount / 46) * stress, 0.2, 0.48);
    this.damageFlash.setAlpha(flashAlpha);
    this.damageFrameTop.setAlpha(frameAlpha);
    this.damageFrameBottom.setAlpha(frameAlpha);
    this.damageFrameLeft.setAlpha(frameAlpha);
    this.damageFrameRight.setAlpha(frameAlpha);
    this.tweens.killTweensOf([
      this.damageFlash,
      this.damageFrameTop,
      this.damageFrameBottom,
      this.damageFrameLeft,
      this.damageFrameRight
    ]);
    this.tweens.add({
      targets: [
        this.damageFlash,
        this.damageFrameTop,
        this.damageFrameBottom,
        this.damageFrameLeft,
        this.damageFrameRight
      ],
      alpha: 0,
      duration: ratio <= 0.25 ? 312 : ratio <= 0.5 ? 288 : 268,
      ease: 'Quad.easeOut'
    });
  }

  private pulseCorruption(): void {
    this.corruptionVeil.setAlpha(0.18);
    this.tweens.killTweensOf(this.corruptionVeil);
    this.tweens.add({
      targets: this.corruptionVeil,
      alpha: this.getAtmosphereOptions().corruptionAlpha,
      duration: 360,
      ease: 'Quad.easeOut'
    });
  }

  private updateAtmospherePulse(): void {
    if (this.gamePaused || !this.playerAlive || this.levelComplete) return;
    if (this.time.now < this.nextAmbientCueAt) return;
    const boss = this.getLiveBosses()[0] ?? null;
    const bossPhase: 0 | 1 | 2 | 3 = boss ? boss.phase : 0;
    const dirState = this.directorDebug?.state;
    const pressure = dirState === 'AMBUSH' || dirState === 'PRESSURE';
    const lowHp = this.playerHealth <= 26;
    const plan = getDynamicAmbientAudioPlan({
      inCombat: pressure || this.countLivingEnemies() > 0,
      bossPhase,
      lowHp,
      worldSegment: this.getWorldSegment()
    });
    this.audioFeedback.play(plan.primary.cue, plan.primary.intensity, this.time.now);
    for (const overlay of plan.overlays) {
      this.audioFeedback.play(overlay.cue, overlay.intensity, this.time.now + 90);
    }
    this.nextAmbientCueAt = this.time.now + plan.intervalMs;
  }

  private applyExploderBursts(): void {
    for (let i = 0; i < this.enemies.length; i += 1) {
      const enemy = this.enemies[i];
      if (enemy.exploded) continue;
      const burstDamage = enemy.exploderBurstDamage ?? 0;
      if (burstDamage <= 0) continue;
      const close = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y) <= 0.95;
      if ((close || !enemy.alive) && this.playerAlive && !this.levelComplete) {
        enemy.exploded = true;
        this.damagePlayer(burstDamage);
        this.setCombatMessage('ESTALLIDO EXPLOSIVO', 900);
        this.pulseFeedback(0xffa35a, 0.1, 180);
      }
    }
  }

  private updateCorruptionSurge(): void {
    if (!this.activeLevelEvent.effects.corruptionSurge) return;
    if (this.time.now >= this.nextCorruptionZoneAt && this.corruptionZone === null) {
      const rng = createSeededLevelEventRng(`${this.currentLevel.id}:corrupt:${Math.floor(this.time.now / 1000)}`);
      const zoneX = Phaser.Math.Clamp(this.player.x + (rng() * 8 - 4), 1.5, this.map.grid[0].length - 1.5);
      const zoneY = Phaser.Math.Clamp(this.player.y + (rng() * 8 - 4), 1.5, this.map.grid.length - 1.5);
      this.corruptionZone = {
        x: zoneX,
        y: zoneY,
        radius: 1.1 + rng() * 0.65,
        expiresAt: this.time.now + 2800,
        nextTickAt: this.time.now + 420
      };
      this.nextCorruptionZoneAt = this.time.now + 7000;
      this.setCombatMessage('ZONA DE CORRUPCIÓN FORMADA', 1300);
      return;
    }
    if (!this.corruptionZone) return;
    if (this.time.now >= this.corruptionZone.expiresAt) {
      this.corruptionZone = null;
      return;
    }
    if (this.time.now >= this.corruptionZone.nextTickAt) {
      this.corruptionZone.nextTickAt = this.time.now + 420;
      if (Math.hypot(this.player.x - this.corruptionZone.x, this.player.y - this.corruptionZone.y) <= this.corruptionZone.radius) {
        this.damagePlayer(2);
      }
    }
  }

  private updateBlackoutPulse(): void {
    if (!this.activeLevelEvent.effects.blackoutPulse) return;
    if (this.countLivingEnemies() < 2) return;
    if (this.time.now < this.blackoutPulseUntil) return;
    const rng = createSeededLevelEventRng(`${this.currentLevel.id}:blackout:${Math.floor(this.time.now / 1000)}`);
    if (rng() < 0.15) {
      this.blackoutPulseUntil = this.time.now + 780;
      this.setCombatMessage('PULSO DE APAGÓN // SIGUE MOVIMIENTO', 900);
    }
  }

  private updateBossArenaHazards(): void {
    if (!this.bossHazards) return;
    const tick = tickRaycastBossHazards(this.bossHazards, {
      nowMs: this.time.now,
      player: { x: this.player.x, y: this.player.y },
      bossAlive: this.getLiveBosses().length > 0
    });
    if (tick.damage > 0) this.damagePlayer(tick.damage);
    if (tick.triggerDarknessPulse) {
      this.blackoutPulseUntil = Math.max(this.blackoutPulseUntil, this.time.now + 700);
      this.setCombatMessage('PULSO DE PELIGRO // BAJA VISIBILIDAD', 800);
    }
    if (tick.telegraphLabels.length > 0) {
      this.setCombatMessage(`HAZARD TELEGRAPH // ${tick.telegraphLabels.slice(0, 2).join(' + ')}`, 900);
    }
  }

  private tryTriggerEncounterBeat(predicate: (beat: RaycastEncounterBeat) => boolean): boolean {
    const beat = this.currentLevel.encounterBeats.find((candidate) => {
      if (this.completedEncounterBeats.has(candidate.id)) return false;
      if (candidate.requiresTriggerId && !this.triggerSystem.hasActivated(candidate.requiresTriggerId)) return false;
      return predicate(candidate);
    });
    if (!beat) return false;

    this.completedEncounterBeats.add(beat.id);
    this.audioFeedback.play(beat.directorState === 'RECOVERY' ? 'directorRecovery' : 'directorWarning', 0.8, this.time.now);
    if (beat.directorState === 'RECOVERY') this.pulseFeedback(RAYCAST_PALETTE.plasmaBright, 0.04, 140);
    else this.pulseFeedback(0xff5b6f, 0.04, 130);
    if (beat.directorState !== 'RECOVERY') this.pulseCorruption();
    this.setCombatMessage(beat.message);
    this.stageSetpieceCue(beat.setpieceCue);
    return true;
  }

  /** Authored tension beats — overlays + audio only (see `RaycastSetpieceCue`). */
  private stageSetpieceCue(cue: RaycastSetpieceCue | undefined): void {
    if (!cue || this.gamePaused) return;
    const opts = this.getAtmosphereOptions();
    const now = this.time.now;

    if (cue === 'BLACKOUT_PULSE') {
      this.corruptionVeil.setAlpha(Math.min(0.4, opts.corruptionAlpha + 0.22));
      this.tweens.killTweensOf(this.corruptionVeil);
      this.tweens.add({
        targets: this.corruptionVeil,
        alpha: opts.corruptionAlpha,
        duration: 520,
        ease: 'Quad.easeOut'
      });
      this.cameras.main.flash(130, 12, 14, 18, false);
      this.audioFeedback.play('directorWarning', 0.48, now);
      return;
    }

    if (cue === 'ALARM_SURGE') {
      this.audioFeedback.play('directorWarning', 0.88, now);
      this.pulseFeedback(0xff2244, 0.07, 110);
      this.time.delayedCall(120, () => this.pulseFeedback(0xff5533, 0.055, 95));
      this.time.delayedCall(260, () => this.audioFeedback.play('stingerDread', 0.42, now + 260));
      return;
    }

    if (cue === 'RITUAL_PULSE') {
      this.pulseCorruption();
      this.pulseFeedback(RAYCAST_PALETTE.riftBloom, 0.1, 220);
      this.audioFeedback.play('directorAmbush', 0.62, now + 40);
      return;
    }

    if (cue === 'FAKE_CALM') {
      this.audioFeedback.play('directorRecovery', 0.58, now);
      this.pulseFeedback(RAYCAST_PALETTE.plasmaBright, 0.052, 180);
      this.corruptionVeil.setAlpha(Math.max(0.03, opts.corruptionAlpha * 0.45));
      this.tweens.killTweensOf(this.corruptionVeil);
      this.tweens.add({
        targets: this.corruptionVeil,
        alpha: opts.corruptionAlpha,
        duration: 520,
        ease: 'Quad.easeOut'
      });
      return;
    }

    if (cue === 'CORRIDOR_HUNT') {
      this.audioFeedback.play('directorWarning', 0.74, now);
      this.audioFeedback.play('uiSoftDeny', 0.44, now + 55);
      this.pulseFeedback(0xffaa44, 0.068, 140);
      return;
    }

    if (cue === 'ARENA_LOCKDOWN') {
      this.audioFeedback.play('directorAmbush', 0.72, now);
      this.audioFeedback.play('stingerDread', 0.38, now + 60);
      this.pulseFeedback(0xff2244, 0.075, 125);
      this.damageFrameTop.setAlpha(0.28);
      this.damageFrameBottom.setAlpha(0.28);
      this.tweens.killTweensOf([this.damageFrameTop, this.damageFrameBottom]);
      this.tweens.add({
        targets: [this.damageFrameTop, this.damageFrameBottom],
        alpha: 0,
        duration: 220,
        ease: 'Quad.easeOut'
      });
    }
  }

  private getNearestAvailableHealthPickupDistance(): number | null {
    const distances = this.currentLevel.healthPickups
      .filter((pickup) => !this.collectedHealthPickups.has(pickup.id))
      .filter((pickup) => {
        const requiredDoors = pickup.requiredOpenDoorIds ?? [];
        if (!requiredDoors.every((doorId) => this.doorSystem.isOpen(doorId))) return false;
        return isRaycastPointReachable(this.currentLevel, pickup, { openDoorIds: requiredDoors });
      })
      .map((pickup) => Math.hypot(pickup.x - this.player.x, pickup.y - this.player.y));

    return distances.length > 0 ? Math.min(...distances) : null;
  }

  // ── Multiplayer helpers ─────────────────────────────────────────────────────

  /**
   * Replaces the local enemies array with authoritative data from the server
   * snapshot. Existing entries are updated in-place to preserve client-side
   * visual state (hit flash, death burst, stagger, etc.).
   * New entries are created via createRaycastEnemy (which already initialises
   * variant='BASE' and all optional fields to neutral values), then overridden
   * with server-authoritative hp/position/state.
   *
   * The server is authoritative for hp, position, and FSM state.
   * Variant/elite metadata stays BASE for server-spawned enemies — the protocol
   * does not carry variant info yet.
   * TODO: add variant field to EnemyState in shared/types.ts in a future phase.
   */
  /**
   * Applies server-authoritative key and door state from the snapshot.
   * Only called in co-op (netConnected); single-player uses local systems.
   *
   * Keys are synced first so that doorSystem.attemptOpen() can find them
   * when we subsequently force-open doors the server has already opened.
   * Opening a door via this path mutates this.map (same as tryOpenDoor)
   * but skips audio/narration — that feedback can be added later.
   */
  private syncLevelStateFromSnapshot(snap: SnapshotMessage): void {
    // ── Keys ───────────────────────────────────────────────────────────────
    for (const keyId of snap.level.keysCollected) {
      if (this.keySystem.hasKey(keyId)) continue;
      const key = this.currentLevel.keys.find((k) => k.id === keyId);
      if (key) this.keySystem.collect(key);
    }

    // ── Doors ──────────────────────────────────────────────────────────────
    // After key sync above, any key the server used to open a door is now in
    // the local keySystem, so attemptOpen(door, 0) will succeed.
    for (const doorState of snap.doors) {
      if (!doorState.open || this.doorSystem.isOpen(doorState.id)) continue;
      const door = this.currentLevel.doors.find((d) => d.id === doorState.id);
      if (!door) continue;
      const result = this.doorSystem.attemptOpen(door, 0);
      if (!result.opened) continue;
      openRaycastDoor(this.map, door);
      // Invalidate minimap cache so the open door is reflected immediately.
      this.mapLayoutRevision += 1;
      this.minimapStaticCellsCacheKey = '';
      this.minimapStaticCells = null;
    }
  }

  private syncEnemiesFromSnapshot(enemyStates: EnemyState[]): void {
    const existingById = new Map(this.enemies.map((e) => [e.id, e]));
    this.enemies = enemyStates.map((es) => {
      const existing = existingById.get(es.id);
      const alive = es.state !== 'DEAD';
      const now = this.time.now;

      if (existing) {
        // Update server-authoritative fields; preserve client visual state.
        existing.x = es.x;
        existing.y = es.y;
        existing.health = es.hp;
        existing.alive = alive;
        existing.spawnTelegraphUntil = es.state === 'SPAWN' ? now + 9999 : 0;
        existing.attackWindupUntil = es.state === 'ATTACK' ? now + 9999 : 0;
        return existing;
      }

      // New enemy from server: createRaycastEnemy already sets variant='BASE'
      // and all optional fields to safe neutral defaults.
      const enemy = createRaycastEnemy({ id: es.id, kind: es.archetype as EnemyKind, x: es.x, y: es.y });
      enemy.health = es.hp;
      enemy.alive = alive;
      if (es.state === 'SPAWN') enemy.spawnTelegraphUntil = now + 9999;
      if (es.state === 'ATTACK') enemy.attackWindupUntil = now + 9999;
      return enemy;
    });
  }

  /**
   * Converts remote PlayerState entries from the last server snapshot into
   * RaycastBillboards so the renderer draws them as colored circles in 3D.
   * Rendered as cyan circles (0x00d9ff) with the player name as label.
   * No style glyph — plain circle, visually distinct from enemies and pickups.
   */
  private buildRemotePlayerBillboards(): RaycastBillboard[] {
    if (!this.netState) return [];
    return this.netState.getRemotePlayers().map((p) => ({
      x: p.x,
      y: p.y,
      color: 0x00d9ff,
      radius: 0.28,
      label: p.name.slice(0, 8).toUpperCase()
    }));
  }
}
