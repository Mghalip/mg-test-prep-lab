'use strict';
/* Lesson catalog. Titles only; the lesson files themselves live in the private "mg-lessons" bucket.
   `src` is the old public path, used once by the teacher page to copy files into the bucket. */
window.MGLessons = (() => {
const VERSION = '20261122';
const pad = n => String(n).padStart(2, '0');
const COURSES = {
  sat: [
    { id: 'reading', g: '读', zh: 'SAT 阅读', en: 'SAT Reading' },
    { id: 'writing', g: '语', zh: 'SAT 语法', en: 'SAT Writing' },
    { id: 'math', g: '数', zh: 'SAT 数学', en: 'SAT Math' }
  ],
  act: [
    { id: 'english', g: 'E', zh: 'ACT 语法', en: 'ACT English' },
    { id: 'reading', g: 'R', zh: 'ACT 阅读', en: 'ACT Reading' },
    { id: 'math', g: 'M', zh: 'ACT 数学', en: 'ACT Math' }
  ],
  math: []
};
const items = [];
function add(subject, course, letter, dir, list, file) {
  list.forEach((row, n) => {
    const [title, zh] = Array.isArray(row) ? row : [row, ''];
    items.push({
      id: `${subject}-${course}-${pad(n)}`, subject, course, n, title, zh,
      key: `${subject}/${course}/${letter}${pad(n)}.html`,
      src: `lessons/${dir}/${file(n, title)}`
    });
  });
}
const under = s => s.replace(/ /g, '_');

add('sat', 'reading', 'R', 'sat-reading', [
  ['Introduction', '阅读导论：考试结构、题型、读法'], ['Words in Context I', '语境词义（一）：找线索'], ['Words in Context II', '语境词义（二）：对比、否定与精确'],
  ['Overall Structure', '全文结构'], ['Sentence Function', '句子功能'], ['Text Purpose', '写作目的'], ['Cross-Text Connections', '双篇关系'],
  ['Central Ideas', '中心思想'], ['Details', '细节理解'], ['Command of Textual Evidence', '文字证据：引文例证'],
  ['Citing Textual Evidence', '引用证据：加强与削弱'], ['Quantitative Evidence', '图表证据'], ['Inferences', '推断：补全结论']
], (n, t) => `R${pad(n)}_${under(t)}.html`);

add('sat', 'writing', 'G', 'sat-writing', [
  'Introduction', 'Linking Clauses I', 'Linking Clauses II', 'Supplements', 'Colons Semicolons Question Marks', 'Subject-Verb Agreement',
  'Verb Forms', 'Pronouns and Possessives', 'Modifier Placement', 'Transitions', 'Rhetorical Synthesis I', 'Rhetorical Synthesis II'
], (n, t) => `G${pad(n)}_${under(t)}.html`);

add('sat', 'math', 'M', 'sat-math', [
  'Introduction', 'Linear Equations', 'Linear Functions', 'Linear Models', 'Systems', 'Inequalities', 'Equivalent Expressions', 'Quadratics',
  'Nonlinear Equations', 'Exponential Functions', 'Functions and Transformations', 'Ratios Rates Units', 'Percentages', 'One-Variable Data',
  'Two-Variable Data', 'Probability and Inference', 'Area and Volume', 'Lines Angles Triangles', 'Right Triangles Trig', 'Circles'
], (n, t) => `M${pad(n)}_${under(t)}.html`);

add('act', 'english', 'E', 'act-english', [
  'Introduction', 'Sentence Boundaries', 'Commas', 'Colons, Semicolons, Dashes & Apostrophes', 'Verbs', 'Pronouns',
  'Modifiers, Parallelism & Idioms', 'Transitions', "Adding, Deleting & Writer's Goal", 'Organization', 'Concision & Redundancy', 'Word Choice, Style & Tone'
], (n, t) => encodeURIComponent(`ACT English ${pad(n)} ${t}.html`));

add('act', 'reading', 'R', 'act-reading', [
  'Introduction', 'Main Idea', 'Paragraph Main Point & Summary', 'Detail', 'Inference', 'Relationships', 'Words & Phrases in Context',
  'Purpose & Function', 'Point of View & Tone', 'Paired Passages', 'Claims, Evidence & Fact vs Opinion'
], (n, t) => encodeURIComponent(`ACT Reading ${pad(n)} ${t}.html`));

add('act', 'math', 'M', 'act-math', [
  'Introduction', 'Numbers & Operations', 'Ratios, Rates, Percents & Units', 'Linear Equations & Inequalities', 'Word Problems & Systems',
  'Exponents, Radicals & Polynomials', 'Quadratics & Rational Expressions', 'Functions', 'Lines & Coordinate Geometry',
  'Sequences, Exponentials & Logarithms', 'Angles, Triangles & Polygons', 'Perimeter, Area & Volume', 'Trigonometry', 'Statistics & Data',
  'Probability & Counting', 'Complex Numbers, Vectors & Matrices'
], (n, t) => encodeURIComponent(`ACT Math ${pad(n)} ${t}.html`));

// Display titles: SAT file names use underscores for spaces; restore readable punctuation.
for (const it of items) {
  if (it.subject === 'sat' && it.course === 'writing' && it.n === 4) it.title = 'Colons, Semicolons & Question Marks';
  if (it.subject === 'sat' && it.course === 'math') it.title = it.title.replace('Ratios Rates Units', 'Ratios, Rates & Units').replace('Lines Angles Triangles', 'Lines, Angles & Triangles').replace('Right Triangles Trig', 'Right Triangles & Trigonometry');
}
// The reading lesson 11 file is named after the full skill.
items.find(i => i.id === 'sat-reading-11').src = 'lessons/sat-reading/R11_Quantitative_Evidence.html';

const byId = id => items.find(i => i.id === id) || null;
const forSubject = s => items.filter(i => i.subject === s);
const forCourse = (s, c) => items.filter(i => i.subject === s && i.course === c);
return Object.freeze({ VERSION, COURSES, items, byId, forSubject, forCourse });
})();
