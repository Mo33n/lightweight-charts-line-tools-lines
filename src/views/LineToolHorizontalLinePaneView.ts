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
	 * To ensure arrows (line ends) appear at the screen edges, we calculate 
	 * the physical boundaries (0 and Width) and pass them to the renderer.
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
        
		// --- 3. Vector Manufacture: Mapping to Screen Edges ---
		
		const anchorX = anchorPoint.x; 
		const lineY = anchorPoint.y;
		const paneDrawingWidth = this._tool.getChartDrawingWidth();
		const { left: extendLeft, right: extendRight } = options.line.extend;

		/**
		 * BOUNDARY CALCULATION
		 * 
		 * To ensure 'line.end.right' and 'line.end.left' sit at the screen edges:
		 * - If extend.left is true, the left end is at pixel 0.
		 * - If extend.right is true, the right end is at paneDrawingWidth.
		 * - Otherwise, the end sits at the anchor point.
		 */
		const startX = extendLeft ? 0 : anchorX;
		const endX = extendRight ? paneDrawingWidth : anchorX;

		// We ensure a minimum width of 1px so the SegmentRenderer can determine direction
		const finalEndX = (startX === endX) ? endX + 1 : endX;

		const leftPoint = new AnchorPoint(startX as Coordinate, lineY, 0);
		const rightPoint = new AnchorPoint(finalEndX as Coordinate, lineY, 1);

		// --- 4. Line Rendering: SegmentRenderer ---
		
		const lineOptions = deepCopy(options.line) as any;
		lineOptions.join = lineOptions.join || LineJoin.Miter;
		lineOptions.cap = lineOptions.cap || LineCap.Butt;

		/**
		 * LINE RENDERER DATA SETUP
		 * 
		 * We pass the calculated edge points. The SegmentRenderer will now
		 * draw the arrows at these exact edge coordinates.
		 */
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

			/**
			 * THE TEXT BOUNDARY GUARD
			 * 
			 * We reuse the calculated startX and endX to ensure the text 
			 * alignment perfectly matches the line endpoints/arrows.
			 */
			const minXBound = Math.min(startX, endX);
			const maxXBound = Math.max(startX, endX);
			const segmentWidth = maxXBound - minXBound;

			let textPivotX: Coordinate;

			switch (horizontalAlignment) {
				case BoxHorizontalAlignment.Left.toLowerCase():
					textPivotX = minXBound as Coordinate;
					break;
				case BoxHorizontalAlignment.Right.toLowerCase():
					// Since paneDrawingWidth excludes the price axis, this 
					// will be perfectly hugged against the right edge.
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