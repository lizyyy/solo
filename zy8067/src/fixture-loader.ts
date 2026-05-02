import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { Fixture } from './types.js';

export class FixtureLoader {
  async load(pluginDir: string): Promise<Fixture[]> {
    const fixturesDir = join(pluginDir, 'fixtures');
    const files = await readdir(fixturesDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    const fixtures: Fixture[] = [];
    
    for (const file of jsonFiles) {
      const filePath = join(fixturesDir, file);
      const content = await readFile(filePath, 'utf-8');
      const fixture = JSON.parse(content) as Fixture;
      fixture.name = fixture.name || file.replace('.json', '');
      fixtures.push(fixture);
    }
    
    return fixtures;
  }
}