import crypto from 'crypto';

export class AnalysisQueue {
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
    this.cache = new Map(); // hash -> result
  }

  getContentHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async enqueue(file, content, analysisFn) {
    const hash = this.getContentHash(content);
    
    // Check cache
    if (this.cache.has(hash)) {
      return this.cache.get(hash);
    }
    
    return new Promise((resolve, reject) => {
      this.queue.push({
        file,
        hash,
        analysisFn,
        resolve,
        reject
      });
      
      this._processNext();
    });
  }

  async _processNext() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }
    
    this.running++;
    const task = this.queue.shift();
    
    try {
      const result = await task.analysisFn();
      this.cache.set(task.hash, result);
      
      // Limit cache size
      if (this.cache.size > 1000) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      
      task.resolve(result);
    } catch (e) {
      task.reject(e);
    } finally {
      this.running--;
      this._processNext();
    }
  }
}
