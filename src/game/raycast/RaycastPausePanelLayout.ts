import { GAME_HEIGHT, GAME_WIDTH } from '../dimensions';

export interface RaycastPausePanelLayout {
  panelWidth: number;
  panelHeight: number;
  centerX: number;
  centerY: number;
  bodyWrapWidth: number;
  titleY: number;
  bodyY: number;
  fontSize: string;
  lineSpacing: number;
}

/** Centers pause panel on viewport with safe margins. */
export function computeRaycastPausePanelLayout(
  viewWidth: number = GAME_WIDTH,
  viewHeight: number = GAME_HEIGHT,
): RaycastPausePanelLayout {
  const short = viewWidth <= 720 || viewHeight <= 500;
  const panelWidth = Math.min(short ? 580 : 660, viewWidth - 40);
  const panelHeight = Math.min(short ? 400 : 460, viewHeight - 48);
  const centerX = viewWidth * 0.5;
  const centerY = viewHeight * 0.5;
  const panelTop = centerY - panelHeight * 0.5;

  return {
    panelWidth,
    panelHeight,
    centerX,
    centerY,
    bodyWrapWidth: panelWidth - 40,
    titleY: panelTop + 12,
    bodyY: panelTop + 44,
    fontSize: short ? '10px' : '11px',
    lineSpacing: short ? 4 : 5,
  };
}
