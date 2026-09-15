/**
 * Ruleset registry. Each ruleset is a genuinely different gameplay driver -
 * different entities, different systems, different win conditions - not one
 * engine with a genre flag.
 */
import * as arena from './arena.js';
import * as platformer from './platformer.js';
import * as puzzle from './puzzle.js';
import * as racer from './racer.js';
import * as defense from './defense.js';
import * as runner from './runner.js';
import * as stealth from './stealth.js';
import * as explorer3d from './explorer3d.js';

const REGISTRY = { arena, platformer, puzzle, racer, defense, runner, stealth, explorer3d };

export function getRuleset(name) {
  const rs = REGISTRY[name];
  if (!rs) throw new Error(`unknown ruleset: ${name}`);
  return rs;
}

export function rulesetNames() { return Object.keys(REGISTRY); }
