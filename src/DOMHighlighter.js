// @flow

import EventEmitter from 'events';

import type { HighlightQuery } from './typedefs';
import createFinder from './createFinder';
import TextContent from './TextContent';
import HighlightMarkers from './HighlightMarkers';
import Group from './Group';
import Cursor from './Cursor';
import TextRange from './TextRange';
import IdGenerator from './IdGenerator';
import HighlightRenderer from './HighlightRenderer';
import HighlightDecorator from './HighlightDecorator';

export type HighlightHits = Array<TextRange>;
type QueryPredicate = TextRange => any;

export default class DOMHighlighter extends EventEmitter {
  container: HTMLElement;
  cursor: Cursor;
  content: TextContent;
  idGenerator: IdGenerator;
  markers: HighlightMarkers;
  groups: Map<string, Group>;
  highlightRenderer: HighlightRenderer;

  constructor(
    container: HTMLElement,
    idGenerator: IdGenerator,
    highlightDecorator: HighlightDecorator
  ) {
    super();

    this.container = container;
    this.content = new TextContent(container);
    this.content.parse();
    this.groups = new Map();
    this.markers = new HighlightMarkers(this.groups);
    this.cursor = new Cursor(this.markers, highlightDecorator);

    this.highlightRenderer = new HighlightRenderer(this.content, highlightDecorator);
    this.idGenerator = idGenerator;
  }

  dispose(): void {
    this.removeAllListeners();
    this.clear();
    this.content.dispose();
    this.markers.dispose();
  }

  setContainer(container: HTMLElement): void {
    this.container = container;
    this.refresh();
  }

  refresh(): void {
    // Forcefully normalise text nodes
    this.container.normalize();

    if (this.content.root !== this.container) {
      this.content.setRoot(this.container);
    } else {
      this.content.parse();
    }
  }

  clear(): void {
    if (this.groups.size > 0) {
      this.groups.forEach(g => g.remove());
    }

    this.refresh();
  }

  create(name: string): Group {
    if (this.groups.has(name)) {
      throw new Error(`Group already exists (${name})`);
    }

    const group = new Group(name, this);
    group.on('remove', () => {
      this.groups.delete(name);
      this.emit('remove', group);
    });

    this.groups.set(name, group);
    return group;
  }

  has(name: string): boolean {
    return this.groups.has(name);
  }

  group(name: string): Group {
    const group = this.groups.get(name);
    if (group == null) {
      throw new Error(`Group not found: ${name}`);
    }

    return group;
  }

  query(query: HighlightQuery, predicate: QueryPredicate): void {
    const finder = createFinder(this.content, query);

    let hit;
    while ((hit = finder.next()) != null) {
      predicate(hit);
    }
  }
}