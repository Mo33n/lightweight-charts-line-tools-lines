import { IChartApiBase, ISeriesApi, SeriesType } from 'lightweight-charts';
import { LineToolPaneView, CompositeRenderer, SegmentRenderer } from 'lightweight-charts-line-tools-core';
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
export declare class LineToolHorizontalLinePaneView<HorzScaleItem> extends LineToolPaneView<HorzScaleItem> {
    /**
     * Internal renderer for the main horizontal line segment.
     * @protected
     */
    protected _lineRenderer: SegmentRenderer<HorzScaleItem>;
    /**
     * Internal renderer for the optional text label.
     * @protected
     */
    /**
     * Initializes the Horizontal Line View.
     *
     * @param source - The specific Horizontal Line model instance.
     * @param chart - The Chart API.
     * @param series - The Series API.
     */
    constructor(source: LineToolHorizontalLine<HorzScaleItem>, chart: IChartApiBase<HorzScaleItem>, series: ISeriesApi<SeriesType, HorzScaleItem>);
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
    protected _updateImpl(height: number, width: number): void;
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
    protected _addAnchors(renderer: CompositeRenderer<HorzScaleItem>): void;
}
