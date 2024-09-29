import { performance, PerformanceObserver } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import EasyTable from 'easy-table';
import Summary from 'summary';

type duration = number;
type Entry = {
  name: string;
  duration: duration;
};

type EntriesByName = Record<string, duration[]>;

export class Performance {
  isEnabled;
  startTime = 0;
  endTime = 0;
  entries: Entry[] = [];
  instanceId: number | undefined;
  fnObserver: PerformanceObserver | undefined;

  constructor(isEnabled: true) {
    this.isEnabled = isEnabled;
    if (isEnabled) {
      this.startTime = performance.now();
      this.instanceId = Math.floor(performance.now() * 100);

      this.fnObserver = new PerformanceObserver(items => {
        items.getEntries().forEach(entry => {
          this.entries.push(entry);
        });
      });
      this.fnObserver.observe({ entryTypes: ['function'] });
    }
  }

  timerify(fn: any) {
    return this.isEnabled ? performance.timerify(fn) : fn;
  }

  setMark(name: string) {
    const id = `${this.instanceId}:${name}`;
    performance.mark(`${id}:start`);
  }

  clearMark(name: string) {
    const id = `${this.instanceId}:${name}`;
    performance.mark(`${id}:end`);
    performance.measure(id, `${id}:start`, `${id}:end`);
    performance.clearMarks(`${id}:start`);
    performance.clearMarks(`${id}:end`);
  }

  async flush() {
    this.setMark('_flush');
    await new Promise(resolve => setTimeout(resolve, 1));
    this.clearMark('_flush');
  }

  getEntriesByName() {
    return this.entries.reduce((entries: EntriesByName, entry) => {
      const name = entry.name.replace(`${this.instanceId}:`, '');
      entries[name] = entries[name] ?? [];
      entries[name].push(entry.duration);
      return entries;
    }, {});
  }

  getTable() {
    const entriesByName = this.getEntriesByName();
    const table = new EasyTable();
    Object.entries(entriesByName).map(([name, values]) => {
      const stats = new Summary(values);
      table.cell('Name', name);
      table.cell('size', stats.size(), EasyTable.number(0));
      table.cell('min', stats.min(), EasyTable.number(2));
      table.cell('max', stats.max(), EasyTable.number(2));
      table.cell('median', stats.median(), EasyTable.number(2));
      table.cell('sum', stats.sum(), EasyTable.number(2));
      table.newRow();
    });
    table.sort(['sum|des']);
    return table.toString().trim();
  }

  getTotalTime() {
    return this.endTime - this.startTime;
  }

  async finalize() {
    if (!this.isEnabled) return;
    this.endTime = performance.now();
    await this.flush(); // Workaround to get all entries
  }

  reset() {
    this.entries = [];
    this.fnObserver?.disconnect();
  }
}
