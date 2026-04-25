// /src/views/LineToolCrossLinePaneView.ts

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
	AnchorPoint,
	LineOptions,
	LineToolOptionsInternal,
	deepCopy,
	LineJoin,
	LineCap,
	PaneCursorType,
} from 'lightweight-charts-line-tools-core';

import { LineToolCrossLine } from '../model/LineToolCrossLine';


/**
 * Pane View for the Cross Line tool.
 *
 * **Tutorial Note on Logic:**
 * The Cross Line is unique because it takes a **Single Point** from the model but renders
 * **Two Infinite Lines** (Horizontal and Vertical).
 *
 * Since the rendering engine draws finite segments, this view is responsible for:
 * 1. Determining the full width and height of the chart pane.
 * 2. Creating a vertical segment from top to bottom at the point's X.
 * 3. Creating a horizontal segment from left to right at the point's Y.
 */
export class LineToolCrossLinePaneView<HorzScaleItem> extends LineToolPaneView<HorzScaleItem> {
	
	// Need two separate renderers for the two distinct segments
	protected _horizontalRenderer: SegmentRenderer<HorzScaleItem> = new SegmentRenderer();
	protected _verticalRenderer: SegmentRenderer<HorzScaleItem> = new SegmentRenderer();

	/**
	 * Initializes the Cross Line View.
	 *
	 * @param source - The specific Cross Line model instance.
	 * @param chart - The Chart API.
	 * @param series - The Series API.
	 */
	public constructor(
		source: LineToolCrossLine<HorzScaleItem>,
		chart: IChartApiBase<HorzScaleItem>,
		series: ISeriesApi<SeriesType, HorzScaleItem>,
	) {
		super(source as BaseLineTool<HorzScaleItem>, chart, series);
	}

	/**
	 * The core update logic.
	 *
	 * It translates the single logical anchor point into two full-screen segments
	 * (Horizontal and Vertical) using stable 1-pixel vectors to prevent 
	 * directional flipping in the buffer zones.
	 *
	 * @param height - The height of the pane.
	 * @param width - The width of the pane.
	 * @protected
	 * @override
	 */
	protected override _updateImpl(height: number, width: number): void {
		this._invalidated = false;
		this._renderer.clear();

		const options = this._tool.options() as LineToolOptionsInternal<'CrossLine'>;
 
		if (!options.visible) {
			return;
		}

		const points = this._tool.points(); 
		if (points.length < 1) {
			return;
		}

		/**
		 * CULLING CHECK
		 * 
		 * We query the pre-calculated culling state from the Model. 
		 */
		if (this._tool.isCulled()) {
			return;
		}

		/**
         * 2. COORDINATE CONVERSION & DIMENSIONS
         */
		const hasScreenPoints = this._updatePoints(); 
		if (!hasScreenPoints) {
			return;
		}

const [anchorPoint] = this._points; 
		const lineX = anchorPoint.x;
		const lineY = anchorPoint.y;
		const paneDrawingHeight = this._tool.getChartDrawingHeight();
		const paneDrawingWidth = this._tool.getChartDrawingWidth();

		const compositeRenderer = new CompositeRenderer<HorzScaleItem>();

		const lineOptions = deepCopy(options.line) as any;
		lineOptions.join = lineOptions.join || LineJoin.Miter;
		lineOptions.cap = lineOptions.cap || LineCap.Butt;
		lineOptions.extend = { left: false, right: false }; // Already spanned manually

		const commonSegmentOptions: LineOptions = lineOptions as LineOptions;
		const commonCursorOptions = {
			toolDefaultHoverCursor: options.defaultHoverCursor,
			toolDefaultDragCursor: options.defaultDragCursor,
		};

		/**
		 * Vertical Segment: Bottom edge (0) to Top edge (Height).
		 * semantic 'right' = Top.
		 */
		const vP0 = new AnchorPoint(lineX, paneDrawingHeight as Coordinate, 0);
		const vP1 = new AnchorPoint(lineX, 0 as Coordinate, 0);
		
		this._verticalRenderer.setData({ 
			points: [vP0, vP1], 
			line: commonSegmentOptions,
			...commonCursorOptions,
		});
		compositeRenderer.append(this._verticalRenderer);

		/**
		 * Horizontal Segment: Left edge (0) to Right edge (Width).
		 * semantic 'right' = Right.
		 */
		const hP0 = new AnchorPoint(0 as Coordinate, lineY, 0);
		const hP1 = new AnchorPoint(paneDrawingWidth as Coordinate, lineY, 0);
		
		this._horizontalRenderer.setData({ 
			points: [hP0, hP1], 
			line: commonSegmentOptions,
			...commonCursorOptions,
		});
		compositeRenderer.append(this._horizontalRenderer);

		// 3. Line Anchors (Handle for Intersection Point)
		this._addAnchors(compositeRenderer);

		this._renderer = compositeRenderer;
	}
	
	/**
	 * Adds the single interactive anchor point at the intersection.
	 *
	 * We use the `Crosshair` cursor to indicate that this point moves freely in 2D space.
	 *
	 * @param renderer - The composite renderer to append the anchor to.
	 * @protected
	 * @override
	 */
	protected override _addAnchors(renderer: CompositeRenderer<HorzScaleItem>): void {
		if (this._points.length < 1) return;

		const [anchorPoint] = this._points;
 
		// The single anchor point (P1) should suggest crosshair/move cursor
		const anchorData = {
			points: [anchorPoint],
			pointsCursorType: [PaneCursorType.Crosshair], // Suggest crosshair/move
		};
 
		// Add the single LineAnchorRenderer set
		renderer.append(this.createLineAnchor(anchorData, 0));
	}
}