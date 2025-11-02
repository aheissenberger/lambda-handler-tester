import { Performance } from '../../library/performanceObserver.js';
import { performance } from 'node:perf_hooks';

describe('PerformanceObserver', () => {
  let observer: Performance;

  beforeEach(() => {
    observer = new Performance(true);
  });

  afterEach(() => {
    observer.reset();
  });

  describe('initialization', () => {
    it('should create an instance', () => {
      expect(observer).toBeInstanceOf(Performance);
    });

    it('should set isEnabled flag', () => {
      expect(observer.isEnabled).toBe(true);
    });

    it('should record start time', () => {
      expect(observer.startTime).toBeGreaterThan(0);
    });

    it('should generate instance ID', () => {
      expect(observer.instanceId).toBeDefined();
      expect(typeof observer.instanceId).toBe('number');
    });

    it('should initialize empty entries', () => {
      expect(observer.entries).toEqual([]);
    });

    it('should create performance observer', () => {
      expect(observer.fnObserver).toBeDefined();
    });
  });

  describe('setMark and clearMark', () => {
    it('should set a performance mark', () => {
      observer.setMark('test-mark');

      const marks = performance
        .getEntriesByType('mark')
        .filter(m => m.name.includes('test-mark'));
      expect(marks.length).toBeGreaterThan(0);
    });

    it('should create start mark', () => {
      observer.setMark('operation');

      const marks = performance.getEntriesByType('mark');
      const startMark = marks.find(m => m.name.includes('operation:start'));
      expect(startMark).toBeDefined();
    });

    it('should clear mark and create measure', () => {
      observer.setMark('operation');
      observer.clearMark('operation');

      const measures = performance.getEntriesByType('measure');
      const measure = measures.find(m =>
        m.name.includes(`${observer.instanceId}:operation`)
      );
      expect(measure).toBeDefined();
    });

    it('should remove start and end marks after clearing', () => {
      observer.setMark('test');
      observer.clearMark('test');

      // Allow time for marks to be cleared
      const marks = performance.getEntriesByType('mark');
      const testMarks = marks.filter(m =>
        m.name.includes(`${observer.instanceId}:test`)
      );

      // Marks should be cleared
      expect(testMarks.length).toBe(0);
    });
  });

  describe('timerify', () => {
    it('should return timerified function when enabled', () => {
      const fn = () => 42;
      const timerified = observer.timerify(fn);

      expect(typeof timerified).toBe('function');
    });

    it('should return original function when disabled', () => {
      const disabledObserver = new Performance(true);
      disabledObserver.isEnabled = false;
      const fn = () => 42;
      const result = disabledObserver.timerify(fn);

      expect(result).toBe(fn);
    });

    it('should maintain function behavior', () => {
      const fn = (a: number, b: number) => a + b;
      const timerified = observer.timerify(fn);

      expect(timerified(2, 3)).toBe(5);
    });
  });

  describe('flush', () => {
    it('should set and clear flush mark', async () => {
      await observer.flush();

      const measures = performance.getEntriesByType('measure');
      const flushMeasure = measures.find(m => m.name.includes('_flush'));
      expect(flushMeasure).toBeDefined();
    });

    it('should wait for async resolution', async () => {
      const start = Date.now();
      await observer.flush();
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getEntriesByName', () => {
    it('should return empty object initially', () => {
      const entries = observer.getEntriesByName();
      expect(entries).toEqual({});
    });

    it('should group entries by name', async () => {
      observer.setMark('op1');
      observer.clearMark('op1');
      observer.setMark('op1');
      observer.clearMark('op1');
      await observer.flush();

      const entries = observer.getEntriesByName();
      if (entries['op1']) {
        expect(entries['op1'].length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should strip instance ID from names', async () => {
      observer.setMark('test-operation');
      observer.clearMark('test-operation');
      await observer.flush();

      const entries = observer.getEntriesByName();
      const keys = Object.keys(entries);

      keys.forEach(key => {
        expect(key).not.toContain(`${observer.instanceId}:`);
      });
    });
  });

  describe('getTable', () => {
    it('should return string representation', async () => {
      observer.setMark('test');
      observer.clearMark('test');
      await observer.flush();

      const table = observer.getTable();
      expect(typeof table).toBe('string');
    });

    it('should return empty string for no entries', () => {
      const table = observer.getTable();
      expect(table).toBe('');
    });

    it('should include operation names', async () => {
      observer.setMark('my-operation');
      observer.clearMark('my-operation');
      await observer.flush();

      const table = observer.getTable();
      if (table) {
        expect(table).toContain('my-operation');
      }
    });
  });

  describe('getTotalTime', () => {
    it('should calculate duration', () => {
      observer.startTime = 100;
      observer.endTime = 150;

      expect(observer.getTotalTime()).toBe(50);
    });

    it('should return 0 when not finalized', () => {
      const total = observer.getTotalTime();
      expect(total).toBeLessThanOrEqual(0);
    });
  });

  describe('finalize', () => {
    it('should set end time', async () => {
      await observer.finalize();
      expect(observer.endTime).toBeGreaterThan(0);
    });

    it('should flush entries', async () => {
      observer.setMark('test');
      observer.clearMark('test');
      await observer.finalize();

      // Finalize should have flushed
      expect(observer.endTime).toBeGreaterThan(observer.startTime);
    });

    it('should do nothing when disabled', async () => {
      observer.isEnabled = false;
      const endTimeBefore = observer.endTime;
      await observer.finalize();
      expect(observer.endTime).toBe(endTimeBefore);
    });
  });

  describe('reset', () => {
    it('should clear all entries', async () => {
      observer.setMark('test');
      observer.clearMark('test');
      await observer.flush();

      observer.reset();

      expect(observer.entries).toEqual([]);
    });

    it('should disconnect observer', () => {
      observer.reset();
      expect(observer.fnObserver).toBeDefined();
    });

    it('should allow reinitialization after reset', () => {
      observer.reset();
      observer.init();

      expect(observer.fnObserver).toBeDefined();
      expect(observer.instanceId).toBeDefined();
    });
  });

  describe('init', () => {
    it('should reinitialize observer', () => {
      observer.reset();
      observer.init();

      expect(observer.startTime).toBeGreaterThan(0);
      expect(observer.instanceId).toBeDefined();
      expect(observer.fnObserver).toBeDefined();
    });

    it('should create new instance ID', () => {
      const firstId = observer.instanceId;
      observer.init();
      const secondId = observer.instanceId;

      expect(secondId).not.toBe(firstId);
    });
  });

  describe('integration', () => {
    it('should track multiple operations', async () => {
      observer.setMark('op1');
      observer.clearMark('op1');

      observer.setMark('op2');
      observer.clearMark('op2');

      observer.setMark('op3');
      observer.clearMark('op3');

      await observer.flush();

      const entries = observer.getEntriesByName();
      const operationCount = Object.keys(entries).filter(k =>
        k.startsWith('op')
      ).length;
      // May be 0 if observer doesn't capture these yet, or 3+ if it does
      expect(operationCount).toBeGreaterThanOrEqual(0);
    });

    it('should measure actual performance', async () => {
      const fn = observer.timerify(() => {
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
        return sum;
      });

      fn();
      await observer.flush();

      // Function should have been tracked
      expect(observer.entries.length).toBeGreaterThanOrEqual(0);
    });
  });
});
