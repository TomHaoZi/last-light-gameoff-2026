export const FIELD_FOLEY = [
  'eli-catch', 'eli-breath', 'eli-recover',
  'boiler-release', 'office-ballast', 'archive-mechanism', 'roof-rain'
];

export const FIELD_STEPS = { concrete: 'step-stone', grate: 'step-grate', carpet: 'step-carpet', metal: 'step-grate' };
export const fieldFoleyURL = name => new URL('./audio/' + name + '.m4a', import.meta.url).href;
