// /src/views/LineToolVerticalLinePaneView.ts

import {
	IChartApiBase,
	ISeriesApi,
	SeriesType,
	Coordinate,
} from 'lightweight-charts';

import {
	BaseLineTool,
	LineToolPaneView,
	CompositeRenderer,
	SegmentRenderer,
	TextRenderer,
	AnchorPoint,
	LineJoin,
	LineCap,
	LineOptions,
	LineToolOptionsInternal,
	LineToolType,
	deepCopy,
	PaneCursorType,
	BoxHorizontalAlignment,
	BoxVerticalAlignment,
} from 'lightweight-charts-line-tools-core';

import { LineToolVerticalLine } from '../model/LineToolVerticalLine';


/**
 * Pane View for the Vertical Line tool.
 *
 * **Tutorial Note on Logic:**
 * This view handles the unique requirement of drawing a line that is fixed in Time (X-axis)
 * but infinite in Price (Y-axis).
 *
 * Instead of relying on the renderer's extension logic, this view explicitly calculates
 * the top (Y=0) and bottom (Y=PaneHeight) coordinates of the current viewport and draws
 * a segment between them. This ensures accurate hit-testing and rendering across the full height.
 */
export class LineToolVerticalLinePaneView<HorzScaleItem> extends LineToolPaneView<HorzScaleItem> {
	
	/**
	 * Internal renderer for the main vertical line segment.
	 * @protected
	 */
	protected _lineRenderer: SegmentRenderer<HorzScaleItem> = new SegmentRenderer();

	/**
	 * Internal renderer for the optional text label.
	 * @protected
	 */
	//protected _textRenderer: TextRenderer<HorzScaleItem> = new TextRenderer();

	/**
	 * Initializes the Vertical Line View.
	 *
	 * @param source - The specific Vertical Line model instance.
	 * @param chart - The Chart API.
	 * @param series - The Series API.
	 */
	public constructor(
		source: LineToolVerticalLine<HorzScaleItem>,
		chart: IChartApiBase<HorzScaleItem>,
		series: ISeriesApi<SeriesType, HorzScaleItem>,
	) {
		super(source as BaseLineTool<HorzScaleItem>, chart, series);
	}

	/**
	 * The core update logic.
	 *
	 * It translates the single logical anchor point into a vertical segment 
	 * spanning the full height of the chart pane using a stable 1-pixel vector.
	 *
	 * @param height - The height of the pane.
	 * @param width - The width of the pane.
	 * @protected
	 * @override
	 */
	protected override _updateImpl(height: number, width: number): void {
		this._invalidated = false;
		this._renderer.clear();

		const options = this._tool.options() as LineToolOptionsInternal<'VerticalLine'>;
 
		if (!options.visible) {
			return;
		}

		const points = this._tool.points(); 
		if (points.length < 1) {
			return;
		}

		/**
		 * CULLING CHECK
		 */
		if (this._tool.isCulled()) {
			return;
		}

		// 1. Convert the single logical point (P1) to a screen anchor.
		const hasScreenPoints = this._updatePoints(); 
		if (!hasScreenPoints) {
			return;
		}

		const [anchorPoint] = this._points; 
		const lineX = anchorPoint.x; 
		const paneDrawingHeight = this._tool.getChartDrawingHeight();

		/**
		 * We map the segment from the Bottom of the pane to the Top.
		 * Index 0 (Left/Start) = Bottom
		 * Index 1 (Right/End) = Top
		 * This ensures 'line.end.right' arrow appears at the TOP.
		 */
		const pBottom = new AnchorPoint(lineX, paneDrawingHeight as Coordinate, 0);
		const pTop = new AnchorPoint(lineX, 0 as Coordinate, 0);

		const compositeRenderer = new CompositeRenderer<HorzScaleItem>();

		const lineOptions = deepCopy(options.line) as any;
		lineOptions.join = lineOptions.join || LineJoin.Miter;
		lineOptions.cap = lineOptions.cap || LineCap.Butt;
		lineOptions.extend = { left: false, right: false }; // Spanned manually

		this._lineRenderer.setData({ 
			points: [pBottom, pTop], 
			line: lineOptions as LineOptions,
			toolDefaultHoverCursor: options.defaultHoverCursor,
			toolDefaultDragCursor: options.defaultDragCursor,
		});
		compositeRenderer.append(this._lineRenderer);

		// 4. Text Renderer (If applicable)
		if (options.text.value) {
			const paneDrawingHeight = this._tool.getChartDrawingHeight();
			const userAngle = options.text.box?.angle || 0;
			const textOptions = deepCopy(options.text);
			textOptions.box = { ...textOptions.box, angle: userAngle + 90 };

			const horizontalAlignment = (options.text.box?.alignment?.horizontal || '').toLowerCase();
			let textPivotY: Coordinate;

			switch (horizontalAlignment) {
				case BoxHorizontalAlignment.Right.toLowerCase(): 
					textPivotY = 0 as Coordinate; 
					break;
				case BoxHorizontalAlignment.Left.toLowerCase(): 
					textPivotY = paneDrawingHeight as Coordinate; 
					break;
				case BoxHorizontalAlignment.Center.toLowerCase():
				default:
					textPivotY = (paneDrawingHeight / 2) as Coordinate;
					break;
			}

			const textAttachmentPoint = new AnchorPoint(lineX, textPivotY, 0); 

			const textRendererData = {
				points: [textAttachmentPoint], 
				text: textOptions, 
				hitTestBackground: true, 
				toolDefaultHoverCursor: options.defaultHoverCursor,
				toolDefaultDragCursor: options.defaultDragCursor,
			};

			this._labelRenderer.setData(textRendererData);
			compositeRenderer.append(this._labelRenderer);
		}

		// 5. Line Anchors (Handle for the intersection)
		this._addAnchors(compositeRenderer);

		this._renderer = compositeRenderer;
	}
	
	/**
	 * Adds the single interactive anchor point.
	 *
	 * We use the `HorizontalResize` cursor because a Vertical Line is fixed in Price (conceptually)
	 * and only moves Left/Right in Time.
	 *
	 * @param renderer - The composite renderer to append the anchor to.
	 * @protected
	 * @override
	 */
	protected override _addAnchors(renderer: CompositeRenderer<HorzScaleItem>): void {
		if (this._points.length < 1) return;

		const [anchorPoint] = this._points;
 
		// The single anchor point (P1) should suggest horizontal movement only
		const anchorData = {
			points: [anchorPoint],
			pointsCursorType: [PaneCursorType.HorizontalResize], // Suggest horizontal resize (ew-resize)
		};
 
		// Add the single LineAnchorRenderer set
		renderer.append(this.createLineAnchor(anchorData, 0));
	}
}