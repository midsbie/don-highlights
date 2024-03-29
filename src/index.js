// @flow

export type { XPathRange, QuerySubject } from "./typedefs";
export { default as createHighlighter } from "./createHighlighter";
export * from "./createHighlighter";
export { default as createFinder } from "./createFinder";
export { getSelectorForHighlightId } from "./dom";
export * from "./HighlightRenderer"; // skipping default

export { default as DonHighlights } from "./DonHighlights";
export { default as Group } from "./Group";
export { default as Highlight } from "./Highlight";
export { default as TextFinder } from "./TextFinder";
export { default as XPathFinder } from "./XPathFinder";
export { default as RangeTranslator } from "./RangeTranslator";
export { default as XPathResolver } from "./XPathResolver";
export { default as TextRange } from "./TextRange";
