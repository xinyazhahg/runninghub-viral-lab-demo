const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { refineBreakdown } = require('../lib/breakdownRefiner');

const dogFixture = {
  speechRecognitionStatus: 'success',
  overview: {
    summary: '穿粉色T恤、黄色背带裤、黄色小鞋并系橙色发绳的小狗坐在花园露台的米色沙发上，先回答问题，听到提醒后震惊捂嘴，随后改口并笑倒。',
    replaceableSubjects: ['狗狗'],
    replaceableScenes: ['花园露台', '厨房'],
    replaceableElements: ['米色沙发', '蛋糕', '桌子', '粉色T恤', '黄色背带裤', '黄色小鞋', '橙色发绳'],
  },
  actionStages: [
    {
      startTime: '0.0', endTime: '2.8', title: '提问并回答', scene: '花园露台', subjects: ['小狗'],
      actions: '听到提问后认真看向镜头，轻微歪头，随后自然张嘴回答。',
      expressions: '专注、坦率', emotion: '平静', dialogue: '画外音：爸爸好看还是妈妈好看？小狗：妈妈好看。',
      sound: '轻微花园环境声', elements: ['米色沙发', '粉色T恤'],
    },
    {
      startTime: '2.8', endTime: '4.5', title: '听到提醒后震惊捂嘴', scene: '花园露台', subjects: ['小狗'],
      actions: '听到提醒后睁大眼睛，头部后缩，随后抬爪捂嘴。',
      expressions: '睁大眼睛', emotion: '由放松转为震惊和紧张', dialogue: '画外音：别被爸爸听到了。',
      sound: '衣物摩擦声', elements: ['客厅沙发', '黄色背带裤'],
    },
    {
      startTime: '4.5', endTime: '7.8', title: '迅速改口', scene: '花园露台', subjects: ['小狗'],
      actions: '移开捂嘴的前爪，身体前探，快速连续张嘴改口。',
      expressions: '讨好、认真', emotion: '由紧张转为急切补救', dialogue: '小狗：爸爸好看，爸爸帅死了。',
      sound: '轻微衣物摩擦声', elements: ['沙发', '黄色小鞋'],
    },
    {
      startTime: '7.8', endTime: '10.0', title: '笑场并倒下', scene: '花园露台', subjects: ['小狗'],
      actions: '听到笑声后放松并开心笑起来，身体向后倾倒，最终仰面躺在沙发上。',
      expressions: '眯眼开心笑', emotion: '开心、撒娇', dialogue: '自然笑声。',
      sound: '笑声、沙发软垫下陷声', elements: ['户外沙发', '橙色发绳'],
    },
  ],
};

test('保留小狗案例真实时间并清洗幻觉与同义项', () => {
  const output = refineBreakdown(dogFixture);
  assert.deepEqual(output.actionStages.map(({ startTime, endTime }) => [startTime, endTime]), [
    ['0.0', '2.8'], ['2.8', '4.5'], ['4.5', '7.8'], ['7.8', '10.0'],
  ]);
  assert.deepEqual(output.actionStages.map(({ title }) => title), [
    '提问并回答', '听到提醒后震惊捂嘴', '迅速改口', '笑场并倒下',
  ]);
  const serialized = JSON.stringify(output);
  assert.equal(serialized.includes('厨房'), false);
  assert.equal(serialized.includes('蛋糕'), false);
  assert.equal(serialized.includes('桌子'), false);
  assert.deepEqual(output.overview.replaceableSubjects, ['小狗']);
  assert.ok(output.overview.replaceableElements.includes('沙发'));
  assert.ok(output.overview.replaceableElements.includes('小狗服装'));
});

test('粗镜头只能按叙事证据细化，缺少可靠时间时保持未确认', () => {
  const output = refineBreakdown({
    overview: { summary: '小狗先回答问题，听到提醒后震惊捂嘴，随后急忙改口，最后开心笑场并倒下。' },
    shots: [{ time: '0-10', description: '小狗回答后听到提醒，震惊捂嘴，急忙改口，笑场倒下。' }],
  });
  assert.equal(output.actionStages.length, 4);
  assert.ok(output.actionStages.every((stage) => stage.time === '未确认时间'));
  assert.ok(output.actionStages.every((stage) => stage.startTime === '未确认'));
});

test('未执行语音识别时不把无字幕误判为无对白', () => {
  const output = refineBreakdown({
    speechRecognitionStatus: 'not_run',
    overview: { summary: '室内客厅里的小狗坐在沙发上。' },
    shots: [{ time: '0-2', scene: '沙发区', subjects: ['狗狗'], actions: '小狗抬头。' }],
  });
  assert.equal(output.actionStages[0].dialogue, '对白尚未识别');
  assert.equal(output.actionStages[0].scene, '客厅');
});

test('任务输出明确保存 raw、cleaned、final 三个拆解版本', () => {
  const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(serverSource, /rawBreakdown/);
  assert.match(serverSource, /cleanedBreakdown/);
  assert.match(serverSource, /finalBreakdown/);
  assert.match(serverSource, /breakdownVersion/);
});

test('客厅小狗案例只以摘要标题描述为证据，独立字段不能让幻觉自证', () => {
  const output = refineBreakdown({
    speechRecognitionStatus: 'success',
    overview: {
      summary: '小狗穿粉色T恤、黄色背带裤和黄色小鞋，系着橙色发绳，坐在客厅的米色沙发上。',
      replaceableSubjects: ['小狗'],
      replaceableScenes: ['厨房'],
      replaceableElements: ['蛋糕', '桌子'],
    },
    shots: [{
      title: '小狗坐在客厅沙发上',
      time: '0-10',
      description: '小狗穿着粉色T恤、黄色背带裤和黄色小鞋，系橙色发绳，坐在客厅的米色沙发上完成动作。',
      scene: '厨房',
      elements: ['蛋糕', '桌子', '粉色T恤', '黄色背带裤', '黄色小鞋', '橙色发绳', '米色沙发'],
    }],
  });

  assert.deepEqual(output.overview.replaceableScenes, ['客厅', '米色沙发']);
  assert.deepEqual(output.actionStages[0].scene, '客厅、米色沙发');
  assert.ok(output.overview.replaceableElements.includes('小狗服装'));
  assert.ok(output.overview.replaceableElements.includes('发绳'));
  assert.ok(output.overview.replaceableElements.includes('米色沙发'));
  assert.equal(JSON.stringify(output).includes('厨房'), false);
  assert.equal(JSON.stringify(output).includes('蛋糕'), false);
  assert.equal(JSON.stringify(output).includes('桌子'), false);
});
