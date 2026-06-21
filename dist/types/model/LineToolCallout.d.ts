import { IChartApiBase, ISeriesApi, IHorzScaleBehavior, SeriesType } from 'lightweight-charts';
import { LineToolPoint, LineToolOptionsInternal, LineToolType, DeepPartial, LineToolsCorePlugin, PriceAxisLabelStackingManager } from 'lightweight-charts-line-tools-core';
import { LineToolTrendLine } from './LineToolTrendLine';
/**
 * Concrete implementation of the Callout drawing tool.
 *
 * **What is a Callout?**
 * A Callout connects a specific point of interest on the chart (P0, the "Pointer")
 * to a text label (P1, the "Anchor"). Unlike a Trend Line, the relationship between
 * these points is directional and semantic, not just geometric.
 *
 * **Inheritance:**
 * It extends {@link LineToolTrendLine} to inherit the underlying 2-point data structure and
 * generic text capability, but uses a specialized View (`LineToolCalloutPaneView`) to render
 * the specific "Stem + Text Box" visual style.
 */
export declare class LineToolCallout<HorzScaleItem> extends LineToolTrendLine<HorzScaleItem> {
    /**
     * The unique identifier for this tool type ('Callout').
     *
     * @override
     */
    readonly toolType: LineToolType;
    /**
     * Defines the number of anchor points required to draw this tool.
     *
     * A Callout requires exactly **2 points**:
     * 1. The target point (where the arrow/line points to).
     * 2. The text box anchor point (where the label sits).
     *
     * @override
     */
    readonly pointsCount: number;
    /**
     * Initializes the Callout tool.
     *
     * **Tutorial Note on Construction:**
     * 1. We start with `TrendLineOptionDefaults` as a base.
     * 2. We apply `CalloutSpecificOverrides` to turn off axis labels and set up the text box styling.
     * 3. We apply user `options` last.
     * 4. Crucially, we assign `LineToolCalloutPaneView` instead of the standard Trend Line view.
     *    This swap is what actually makes the tool look like a Callout on the canvas.
     *
     * @param coreApi - The Core Plugin API.
     * @param chart - The Lightweight Charts Chart API.
     * @param series - The Series API this tool is attached to.
     * @param horzScaleBehavior - The horizontal scale behavior.
     * @param options - Configuration overrides.
     * @param points - Initial points.
     * @param priceAxisLabelStackingManager - The manager for label collision.
     */
    constructor(coreApi: LineToolsCorePlugin<HorzScaleItem>, chart: IChartApiBase<HorzScaleItem>, series: ISeriesApi<SeriesType, HorzScaleItem>, horzScaleBehavior: IHorzScaleBehavior<HorzScaleItem>, options: DeepPartial<LineToolOptionsInternal<'Callout'>>, points: LineToolPoint[] | undefined, priceAxisLabelStackingManager: PriceAxisLabelStackingManager<HorzScaleItem>);
    /**
     * Calculates the Callout's visibility based on its Stem line (P0 to P1).
     *
     * ### Tutorial Note on Callout Culling
     * Even though a Callout involves a complex text box, its geometric visibility
     * is primarily determined by the "Stem"—the line segment connecting the
     * pointer (P0) to the text anchor (P1).
     *
     * This method uses the core culling engine to perform a segment intersection
     * check. If any part of the Stem or the anchor points are within the viewport,
     * the tool is marked as visible.
     *
     * Since Callouts do not typically extend infinitely, the engine uses
     * standard Axis-Aligned Bounding Box (AABB) logic here.
     *
     * @protected
     * @override
     */
    protected updateCullingState(): void;
}
