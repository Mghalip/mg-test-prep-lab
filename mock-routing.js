'use strict';
// Client-side practice routing. UI visibility is not a security boundary.
const MockRouting=(()=>{
const version='content-review-20261017-v1';
const minimums={"A12":{"rw":21,"math":17},"A17":{"rw":21,"math":16},"A18":{"rw":21,"math":17},"A19":{"rw":20,"math":15},"A20":{"rw":20,"math":17},"A21":{"rw":20,"math":16},"A22":{"rw":21,"math":17},"A26":{"rw":20,"math":17},"A27":{"rw":21,"math":17},"A28":{"rw":20,"math":17},"A29":{"rw":20,"math":16},"A30":{"rw":20,"math":17},"A32":{"rw":19,"math":17},"A34":{"rw":21,"math":17},"A35":{"rw":20,"math":16},"A36":{"rw":20,"math":15},"A37":{"rw":19,"math":16},"A42":{"rw":19,"math":17},"A43":{"rw":20,"math":17},"A46":{"rw":20,"math":16},"A47":{"rw":20,"math":16},"A48":{"rw":19,"math":17},"A49":{"rw":21,"math":16},"A52":{"rw":19,"math":16},"A53":{"rw":20,"math":16},"A55":{"rw":20,"math":17}};
function create(id){const p=minimums[id];if(!p)throw Error('Test settings are missing. Please try again later.');return {version,exam:id,rw:p.rw,math:p.math}}
function legacy(id){return {version:'legacy-70-percent',exam:id,rw:19,math:16}}
function validate(p,id){if(!p||p.exam!==id||typeof p.version!=='string'||!Number.isInteger(p.rw)||!Number.isInteger(p.math)||p.rw<18||p.rw>22||p.math<15||p.math>18)throw Error('Invalid test settings. Please start a new test.');return p}
function next(p,section,correct,total){validate(p,p.exam);if(!['rw','math'].includes(section)||total!==(section==='rw'?27:22)||!Number.isInteger(correct)||correct<0||correct>total)throw Error('Invalid module results.');return correct>=p[section]?'harder':'easier'}
return Object.freeze({create,legacy,validate,next});
})();
