const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const score=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../sat-score.js'),'utf8')+';SatScore');
const modules=(rw1,rw2,m1,m2)=>[{module:0,total:27,correct:27-rw1},{module:2,total:27,correct:27-rw2},{module:3,total:22,correct:22-m1},{module:5,total:22,correct:22-m2}];
// Workbook calibration: Practice 11, errors RW 2+6 and Math 1+3.
const anchor=score.fromModules(modules(2,6,1,3));
assert.equal(anchor.rw.center,710);assert.equal(anchor.math.center,740);
assert.equal(anchor.total.center,1450);assert.equal(anchor.total.low,1390);assert.equal(anchor.total.high,1500);
assert.equal(score.fromModules(modules(0,0,0,0)).total.center,1600);
assert.equal(score.fromModules(modules(27,27,22,22)).total.center,400);
assert.equal(score.fromModules(modules(2,8,1,3)).total.center,1410);
assert.notEqual(score.section('rw',2,6).center,score.section('rw',6,2).center);
assert.ok(score.section('rw',10,0).high<=600);assert.ok(score.section('math',8,0).high<=620);
assert.equal(score.fromModules(modules(2,6,1,3).slice(0,3)),null);
assert.equal(score.fromModules([...modules(2,6,1,3).slice(0,3),{module:3,total:22,correct:20}]),null);
assert.equal(score.section('rw',-1,2),null);assert.equal(score.section('math',23,0),null);
console.log('PASS workbook calibration, full/zero results, module-distribution adjustment, range caps, incomplete/invalid records.');
