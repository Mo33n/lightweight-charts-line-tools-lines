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
	 * It translates the single logical anchor point into a vertical segment spanning the full height
	 * of the chart pane. It also handles the complex logic of rotating text 90 degrees and
	 * re-mapping alignment settings (e.g., "Left" alignment becomes "Bottom" on a vertical line).
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
		 * We simply query the pre-calculated state from the Model.
		 */
		if (this._tool.isCulled()) {
			return;
		}

		// --- GET VALIDATED CHART DRAWING HEIGHT ---
		// Use the validated method to get the definitive height of the drawing pane of the chart area only.
		const paneDrawingHeight = this._tool.getChartDrawingHeight();
		//const paneDrawingWidth = this._tool.getChartDrawingWidth();

		// 1. Convert the single logical point (P1) to a screen anchor.
		// We can use the base implementation to get the screen coordinate of P1.
		const hasScreenPoints = this._updatePoints(); 
		if (!hasScreenPoints) {
			return;
		}

		const [anchorPoint] = this._points; // Screen coordinates of the single anchor

		// 2. Manufacture two screen points for the vertical segment (P_Top and P_Bottom).
		const lineX = anchorPoint.x; // The X-coordinate is the same for both
		
		/**
		 * SEGMENT CALCULATION
		 *
		 * We manually construct the vertical segment.
		 * - `pTop`: X = anchor, Y = 0 (Top of pane).
		 * - `pBottom`: X = anchor, Y = paneHeight (Bottom of pane).
		 *
		 * This creates a finite segment that covers the exact visible area.
		 */
		const pTop = new AnchorPoint(lineX, 0 as Coordinate, 0); // P_Top (Y=0)
		const pBottom = new AnchorPoint(lineX, paneDrawingHeight as Coordinate, 0); // P_Bottom (Y=paneHeight)

		// The core segment being drawn is between P_Top and P_Bottom.
		const segmentPoints: [AnchorPoint, AnchorPoint] = [pTop, pBottom];

		// --- Setup Renderers ---
		const compositeRenderer = new CompositeRenderer<HorzScaleItem>();

		// 1. Segment Renderer (The Vertical Line itself)
		const lineOptions = deepCopy(options.line) as any;
		lineOptions.join = lineOptions.join || LineJoin.Miter;
		lineOptions.cap = lineOptions.cap || LineCap.Butt;

		// The Vertical Line does not use extension logic in the SegmentRenderer call,
		// as it is already drawn full-pane-height via P_Top and P_Bottom.
		//lineOptions.extend = { left: false, right: false }; 

		/**
		 * LINE RENDERER DATA SETUP
		 *
		 * We configure the `SegmentRenderer` with our manually created vertical segment.
		 * Explicitly defining the start/end points ensures hit-testing works perfectly
		 * from the very top to the very bottom of the chart.
		 */
		this._lineRenderer.setData({ 
			points: segmentPoints, 
			line: lineOptions as LineOptions,
			toolDefaultHoverCursor: options.defaultHoverCursor,
			toolDefaultDragCursor: options.defaultDragCursor,
		});
		compositeRenderer.append(this._lineRenderer);

		// 2. Text Renderer (If applicable - typically not used for a simple vertical line)
		if (options.text.value) {
			
			// --- Conditional Vertical Rotation ---
			// By default, text is calculated horizontally. For a vertical line, we 
			// rotate the entire box 90 degrees so it aligns parallel to the line. 
			// We add 90 to the user's defined angle to make their setting relative 
			// to this vertical orientation.
			const userAngle = options.text.box?.angle || 0;
			const textOptions = deepCopy(options.text);
			textOptions.box = { ...textOptions.box, angle: userAngle + 90 };
			// --- End Conditional Rotation ---

			// --- Text Attachment Point (Pivot) Calculation ---
			
			/**
			 * TEXT ROTATION & ALIGNMENT LOGIC (Vertical Hugging)
			 *
			 * To provide a consistent experience across tools, we map the 
			 * user's "Horizontal Alignment" settings to the vertical span 
			 * of the vertical line:
			 * 
			 * 1. "Right" Intention -> Sticks to the Top of the screen (Y=0).
			 * 2. "Left" Intention  -> Sticks to the Bottom of the screen (Y=Height).
			 * 3. "Center" Intention -> Remains at the vertical midpoint.
			 * 
			 * To "hug" the edges without a large gap, we place the pivot exactly 
			 * at the edge and override the box's vertical expansion direction.
			 */
			const horizontalAlignment = (options.text.box?.alignment?.horizontal || '').toLowerCase();
			let textPivotY: Coordinate;

			switch (horizontalAlignment) {
				case BoxHorizontalAlignment.Right.toLowerCase(): 
					// Pivot at the absolute top edge
					textPivotY = 0 as Coordinate; 
					// Force the box to expand DOWNWARDS from the top edge
					break;
				case BoxHorizontalAlignment.Left.toLowerCase(): 
					// Pivot at the absolute bottom edge (paneDrawingHeight)
					textPivotY = paneDrawingHeight as Coordinate; 
					// Force the box to expand UPWARDS from the bottom edge
					break;
				case BoxHorizontalAlignment.Center.toLowerCase():
				default:
					// Pivot at the exact center of the visible pane
					textPivotY = (paneDrawingHeight / 2) as Coordinate;
					// Ensure the box remains centered on the middle pivot
					break;
			}

			// Define the anchor point for the text box.
			// X matches the line's position; Y is our calculated "edge" pivot.
			const textAttachmentPoint = new AnchorPoint(lineX, textPivotY, 0); 

			/**
			 * TEXT RENDERER DATA SETUP
			 *
			 * We pass the modified textOptions which now contain the 
			 * corrected 'vertical' expansion to hug the screen edges.
			 * 
			 * Note: We use the inherited 'this._labelRenderer' to ensure that 
			 * the 'forceInvalidate' signal from the core plugin correctly 
			 * clears the layout cache when options are changed.
			 */
			const textRendererData = {
				// Use the calculated edge-aligned pivot
				points: [textAttachmentPoint], 
				text: textOptions, 
				// Enabled to allow selection via the text label area
				hitTestBackground: true, 
				toolDefaultHoverCursor: options.defaultHoverCursor,
				toolDefaultDragCursor: options.defaultDragCursor,
			};

			this._labelRenderer.setData(textRendererData);
			compositeRenderer.append(this._labelRenderer);
		}

		// 3. Line Anchors (Handles for P1)
		//if (this.areAnchorsVisible()) {
			this._addAnchors(compositeRenderer);
		//}

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