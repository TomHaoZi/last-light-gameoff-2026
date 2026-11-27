// The narrator and the pursuer use different recordings and mixer paths.
export const MOURNING_LINES = Object.freeze({
  guide: {
    stem: 'mourning-guide', channel: 'gramophone', seconds: 4.72,
    speaker: ['Gramophone', '留声机'],
    words: [
      'If you hear her crying, keep your eyes down. Whatever you do, don’t meet her eyes.',
      '听见她哭，就低下眼睛。千万别和她对视。'
    ]
  },
  glance: {
    stem: 'mourning-glance', channel: 'warning', seconds: .90,
    speaker: ['Warning', '警告'],
    words: ['Look away!', '别看她！']
  }
});

export const GUIDANCE_LINES = Object.freeze({
  boiler: {
    stem: 'mourning-boiler', channel: 'intercom', seconds: 4.73,
    speaker: ['Boiler room', '锅炉房广播'],
    words: [
      'Mind the steam. Finish the boiler work before you take the lift.',
      '当心蒸汽。做完锅炉房的工作，再乘电梯。'
    ]
  },
  boiler3d: {
    stem: 'mourning-boiler3d', channel: 'intercom', seconds: 4.02,
    speaker: ['Boiler room', '锅炉房广播'],
    words: [
      'Let the steam die down. The first crossing only appears at night.',
      '等蒸汽散开。第一座桥只在夜里出现。'
    ]
  },
  roof: {
    stem: 'mourning-roof', channel: 'intercom', seconds: 4.64,
    speaker: ['Roof handover', '屋顶交接广播'],
    words: [
      'Water the beds first. Then put the exit light on its own circuit.',
      '先给花圃浇水。再把出口灯接上独立回路。'
    ]
  }
});

export const SOB_FILES = ['mourning-sob-soft', 'mourning-sob-held'];
// Interface language only selects captions. Every spoken take is English.
export const fileForVoice = line => line.stem + '-en';
export const mourningVoiceURL = file => new URL('./assets/dialogue/' + file + '.m4a', import.meta.url);
export const mourningCryURL = file => new URL('./audio/' + file + '.m4a', import.meta.url);

export async function decodeOfficeRecording(context, url) {
  try {
    const response = await fetch(url);
    return response.ok ? await context.decodeAudioData(await response.arrayBuffer()) : null;
  } catch {
    return null;
  }
}
