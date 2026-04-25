// /src/views/LineToolHorizontalLinePaneView.ts

import {
	IChartApiBase,
	ISeriesApi,
	SeriesType,
	Coordinate,
	LineStyle,
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
	BoxHorizontalAlignment,
	deepCopy,
	PaneCursorType,
} from 'lightweight-charts-line-tools-core';

import { LineToolHorizontalLine } from '../model/LineToolHorizontalLine';


/**
 * Pane View for the Horizontal Line tool.
 *
 * **Tutorial Note on Logic:**
 * Unlike a Trend Line which connects two points, a Horizontal Line is defined by a **Single Point**
 * but renders a line that spans the width of the chart (or specific rays based on extension options).
 *
 * This view is responsible for:
 * 1. calculating the visible start and end X-coordinates of the line.
 * 2. Positioning the text label specifically relative to the visible segment (e.g., aligning text to the right edge of the screen).
 */
export class LineToolHorizontalLinePaneView<HorzScaleItem> extends LineToolPaneView<HorzScaleItem> {
	
	/**
	 * Internal renderer for the main horizontal line segment.
	 * @protected
	 */
	protected _lineRenderer: SegmentRenderer<HorzScaleItem> = new SegmentRenderer();

	/**
	 * Internal renderer for the optional text label.
	 * @protected
	 */
	//testing removal
	//protected _textRenderer: TextRenderer<HorzScaleItem> = new TextRenderer();

	/**
	 * Initializes the Horizontal Line View.
	 *
	 * @param source - The specific Horizontal Line model instance.
	 * @param chart - The Chart API.
	 * @param series - The Series API.
	 */
	public constructor(
		source: LineToolHorizontalLine<HorzScaleItem>,
		chart: IChartApiBase<HorzScaleItem>,
		series: ISeriesApi<SeriesType, HorzScaleItem>,
	) {
		super(source as BaseLineTool<HorzScaleItem>, chart, series);
	}

	/**
	 * The core update logic for the Horizontal Line View.
	 *
	 * It translates the single logical anchor point into a horizontal segment.
	 * To prevent directional flipping in the buffer zone, we provide a stable 
	 * 1-pixel vector and utilize the renderer's internal extension engine.
	 *
	 * @param height - The height of the pane.
	 * @param width - The width of the pane.
	 * @protected
	 * @override
	 */
	protected override _updateImpl(height: number, width: number): void {
		this._invalidated = false;
		this._renderer.clear();

		const options = this._tool.options() as LineToolOptionsInternal<'HorizontalLine'>;
 
		if (!options.visible) {
			return;
		}

		const points = this._tool.points(); 
		if (points.length === 0) {
			return;
		}
 
		/**
		 * CULLING CHECK
		 * 
		 * Query the Model's pre-calculated culling state.
		 */
		if (this._tool.isCulled()) {
			return;
		}

		// 2. Coordinate Conversion and Setup
		const hasScreenPoints = this._updatePoints(); 
		if (!hasScreenPoints) {
			return;
		}

		const [anchorPoint] = this._points; // Screen coordinates of the single anchor
        
		// --- 3. Vector Manufacture: Stable Spacial Vector ---
		
		const anchorX = anchorPoint.x; 
		const lineY = anchorPoint.y;
		const paneDrawingWidth = this._tool.getChartDrawingWidth();
		const { left: extendLeft, right: extendRight } = options.line.extend;

		/**
		 * To ensure arrowheads render at the screen edges, we must provide 
		 * the edge coordinates to the renderer. 
		 * 
		 * To prevent the "Flip" bug: We force the Right Point to always 
		 * be at least 1px to the right of the Left Point.
		 */
		const startX = extendLeft ? 0 : anchorX;
		const endX = extendRight ? paneDrawingWidth : anchorX;

		// The Guard: Ensure vector always points Left -> Right
		const finalStartX = startX;
		const finalEndX = Math.max(endX, startX + 1);

		const leftPoint = new AnchorPoint(finalStartX as Coordinate, lineY, 0);
		const rightPoint = new AnchorPoint(finalEndX as Coordinate, lineY, 1);

		// --- Line Rendering ---
		const lineOptions = deepCopy(options.line) as any;
		lineOptions.join = lineOptions.join || LineJoin.Miter;
		lineOptions.cap = lineOptions.cap || LineCap.Butt;

		this._lineRenderer.setData({ 
			points: [leftPoint, rightPoint], 
			line: lineOptions as LineOptions,
			toolDefaultHoverCursor: options.defaultHoverCursor,
			toolDefaultDragCursor: options.defaultDragCursor,
		});
		(this._renderer as CompositeRenderer<HorzScaleItem>).append(this._lineRenderer);


		// --- 5. Text Rendering: Bespoke Pivot Calculation ---

		if (options.text.value) {
			const horizontalAlignment = (options.text.box?.alignment?.horizontal || '').toLowerCase();
			const paneDrawingWidth = this._tool.getChartDrawingWidth();
			const { left: extendLeft, right: extendRight } = options.line.extend;

			/**
			 * THE TEXT BOUNDARY GUARD
			 * 
			 * We determine the "visual" start and end of the segment to align 
			 * the text pivot correctly relative to the current viewport.
			 */
			const visualStartX = extendLeft ? 0 : anchorX;
			const visualEndX = extendRight ? paneDrawingWidth : anchorX;

			const minXBound = Math.min(visualStartX, visualEndX);
			const maxXBound = Math.max(visualStartX, visualEndX);
			const segmentWidth = maxXBound - minXBound;

			let textPivotX: Coordinate;

			switch (horizontalAlignment) {
				case BoxHorizontalAlignment.Left.toLowerCase():
					textPivotX = minXBound as Coordinate;
					break;
				case BoxHorizontalAlignment.Right.toLowerCase():
					textPivotX = maxXBound as Coordinate;
					break;
				case BoxHorizontalAlignment.Center.toLowerCase():
				default:
					textPivotX = (minXBound + segmentWidth / 2) as Coordinate;
					break;
			}
 
			const textPivot = new AnchorPoint(textPivotX, anchorPoint.y, 0);

			const textRendererData = {
				points: [textPivot, textPivot], 
				text: options.text,
				hitTestBackground: true,
				toolDefaultHoverCursor: options.defaultHoverCursor,
				toolDefaultDragCursor: options.defaultDragCursor,
			};

			this._labelRenderer.setData(textRendererData);
			(this._renderer as CompositeRenderer<HorzScaleItem>).append(this._labelRenderer);
		}

		// 6. Line Anchors (Handle for the single point)
		this._addAnchors(this._renderer as CompositeRenderer<HorzScaleItem>);
	}
	
	
	/**
	 * Adds the single interactive anchor point.
	 *
	 * We use the `VerticalResize` cursor because a Horizontal Line is typically fixed in Time
	 * and only moves up/down in Price.
	 *
	 * @param renderer - The composite renderer to append the anchor to.
	 * @protected
	 * @override
	 */
	protected override _addAnchors(renderer: CompositeRenderer<HorzScaleItem>): void {
		if (this._points.length < 1) return;

		const [anchorPoint] = this._points;
 
		// The single anchor point (P1)
		const anchorData = {
			points: [anchorPoint],
			pointsCursorType: [PaneCursorType.VerticalResize], // Vertical resize as it only moves in Price
		};
 
		// Add the single LineAnchorRenderer set
		renderer.append(this.createLineAnchor(anchorData, 0));
	}
}