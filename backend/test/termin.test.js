
const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Za teste uporabljamo ločeno začasno SQLite bazo.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'supertutor-test-'));
process.env.SUPERTUTOR_DB_PATH = path.join(tempDir, 'test.sqlite');

const db = require('../models/database');
require('../models/migracija');

const termin = require('../models/termin');

let tutorId;
let studentId;
let predmetId;

beforeEach(() => {
  db.prepare('DELETE FROM obvestilo').run();
  db.prepare('DELETE FROM zapisek').run();
  db.prepare('DELETE FROM termin').run();
  db.prepare('DELETE FROM tutor_predmet').run();
  db.prepare('DELETE FROM predmet').run();
  db.prepare('DELETE FROM uporabnik').run();

  const tutor = db.prepare(`
    INSERT INTO uporabnik
    (ime, priimek, email, geslo_hash, vloga, smer)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('Ana', 'Tutor', 'ana@test.si', 'hash', 'tutor', 'FRI');

  tutorId = tutor.lastInsertRowid;

  const student = db.prepare(`
    INSERT INTO uporabnik
    (ime, priimek, email, geslo_hash, vloga, smer)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('Miha', 'Student', 'miha@test.si', 'hash', 'student', 'FRI');

  studentId = student.lastInsertRowid;

  const predmet = db.prepare(`
    INSERT INTO predmet (naziv) VALUES (?)
  `).run('Programiranje');

  predmetId = predmet.lastInsertRowid;
});

after(() => {
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('ustvari novo dostopnost', () => {
  const rezultat = termin.ustvariDostopnost(
    tutorId, '2099-05-10', '10:00', '11:00'
  );

  assert.equal(rezultat.changes, 1);
});

test('preveri prekrivanje terminov', () => {
  termin.ustvariDostopnost(
    tutorId, '2099-05-10', '10:00', '11:00'
  );

  assert.equal(
    termin.preveriPrekrivanje(tutorId, '2099-05-10', '10:30', '11:30'),
    true
  );
});

test('ne zazna prekrivanja pri ločenih terminih', () => {
  termin.ustvariDostopnost(
    tutorId, '2099-05-10', '10:00', '11:00'
  );

  assert.equal(
    termin.preveriPrekrivanje(tutorId, '2099-05-10', '11:00', '12:00'),
    false
  );
});

test('vrne dostopnosti izbranega tutorja', () => {
  termin.ustvariDostopnost(
    tutorId, '2099-05-10', '10:00', '11:00'
  );

  assert.equal(termin.najdiDostopnostiTutorja(tutorId).length, 1);
});

test('izbriše prost termin tutorja', () => {
  const rezultat = termin.ustvariDostopnost(
    tutorId, '2099-05-10', '10:00', '11:00'
  );

  const izbris = termin.izbrisiDostopnost(
    rezultat.lastInsertRowid, tutorId
  );

  assert.equal(izbris.changes, 1);
});

test('ne izbriše termina drugega tutorja', () => {
  const rezultat = termin.ustvariDostopnost(
    tutorId, '2099-05-10', '10:00', '11:00'
  );

  const izbris = termin.izbrisiDostopnost(
    rezultat.lastInsertRowid, studentId
  );

  assert.equal(izbris.changes, 0);
});

test('omogoča oddajo zahteve za prost termin', () => {
  const rezultat = termin.ustvariDostopnost(
    tutorId, '2099-05-10', '10:00', '11:00'
  );

  const zahteva = termin.oddajZahtevo(
    rezultat.lastInsertRowid,
    studentId,
    predmetId,
    'JavaScript',
    'online',
    'Zoom'
  );

  assert.equal(zahteva.changes, 1);
});

test('prepreči ponovno oddajo zahteve za zaseden termin', () => {
  const rezultat = termin.ustvariDostopnost(
    tutorId, '2099-05-10', '10:00', '11:00'
  );

  const id = rezultat.lastInsertRowid;

  termin.oddajZahtevo(
    id, studentId, predmetId, 'JavaScript', 'online', 'Zoom'
  );

  const drugaZahteva = termin.oddajZahtevo(
    id, studentId, predmetId, 'Java', 'online', 'Zoom'
  );

  assert.equal(drugaZahteva.changes, 0);
});

test('potrdi čakajočo zahtevo tutorja', () => {
  const rezultat = termin.ustvariDostopnost(
    tutorId, '2099-05-10', '10:00', '11:00'
  );

  const id = rezultat.lastInsertRowid;

  termin.oddajZahtevo(
    id, studentId, predmetId, 'JavaScript', 'online', 'Zoom'
  );

  const potrditev = termin.potrdiZahtevo(id, tutorId);

  assert.equal(potrditev.changes, 1);
  assert.equal(termin.najdiPoId(id).status, 'potrjen');
});

test('zavrne zahtevo in sprosti termin', () => {
  const rezultat = termin.ustvariDostopnost(
    tutorId, '2099-05-10', '10:00', '11:00'
  );

  const id = rezultat.lastInsertRowid;

  termin.oddajZahtevo(
    id, studentId, predmetId, 'JavaScript', 'online', 'Zoom'
  );

  const zavrnitev = termin.zavrniZahtevo(id, tutorId);
  const shranjenTermin = termin.najdiPoId(id);

  assert.equal(zavrnitev.changes, 1);
  assert.equal(shranjenTermin.status, 'prost');
  assert.equal(shranjenTermin.student_id, null);
});

test('ne potrdi zahteve, ki ne čaka več na potrditev', () => {
  const rezultat = termin.ustvariDostopnost(
    tutorId, '2099-05-10', '10:00', '11:00'
  );

  const potrditev = termin.potrdiZahtevo(
    rezultat.lastInsertRowid, tutorId
  );

  assert.equal(potrditev.changes, 0);
});

test('pravočasno odpove potrjen termin in obvesti tutorja', () => {
  const rezultat = termin.ustvariDostopnost(
    tutorId, '2099-05-10', '10:00', '11:00'
  );

  const id = rezultat.lastInsertRowid;

  termin.oddajZahtevo(
    id, studentId, predmetId, 'JavaScript', 'online', 'Zoom'
  );

  termin.potrdiZahtevo(id, tutorId);

  const odpoved = termin.odpoviStudent(id, studentId);

  assert.equal(odpoved.uspeh, true);
  assert.equal(odpoved.pozna, false);
  assert.equal(termin.najdiPoId(id).status, 'prost');

  const obvestila = db.prepare(
    'SELECT * FROM obvestilo WHERE uporabnik_id = ?'
  ).all(tutorId);

  assert.equal(obvestila.length, 1);
});

test('ne dovoli odpovedi termina drugega študenta', () => {
  const rezultat = termin.ustvariDostopnost(
    tutorId, '2099-05-10', '10:00', '11:00'
  );

  const id = rezultat.lastInsertRowid;

  termin.oddajZahtevo(
    id, studentId, predmetId, 'JavaScript', 'online', 'Zoom'
  );

  termin.potrdiZahtevo(id, tutorId);

  const odpoved = termin.odpoviStudent(id, tutorId);

  assert.equal(odpoved.uspeh, false);
});

test('prepozna neobstoječ termin', () => {
  assert.equal(termin.jePreteklo(-1), false);
});

test('vrne potrjene termine študenta', () => {
  const rezultat = termin.ustvariDostopnost(
    tutorId, '2099-05-10', '10:00', '11:00'
  );

  termin.oddajZahtevo(
    rezultat.lastInsertRowid,
    studentId,
    predmetId,
    'JavaScript',
    'online',
    'Zoom'
  );

  termin.potrdiZahtevo(rezultat.lastInsertRowid, tutorId);

  assert.equal(
    termin.najdiPotrjeneTermineStudenta(studentId).length,
    1
  );
});

test('vrne samo proste termine tutorja', () => {
  const prvi = termin.ustvariDostopnost(
    tutorId, '2099-05-10', '10:00', '11:00'
  );

  const drugi = termin.ustvariDostopnost(
    tutorId, '2099-05-10', '12:00', '13:00'
  );

  termin.oddajZahtevo(
    drugi.lastInsertRowid,
    studentId,
    predmetId,
    'JavaScript',
    'online',
    'Zoom'
  );

  const prosti = termin.najdiProsteTermineTutorja(tutorId);

  assert.equal(prosti.length, 1);
  assert.equal(prosti[0].id, prvi.lastInsertRowid);
});

test('vrne čakajoče zahteve tutorja', () => {
  const rezultat = termin.ustvariDostopnost(
    tutorId, '2099-05-10', '10:00', '11:00'
  );

  termin.oddajZahtevo(
    rezultat.lastInsertRowid,
    studentId,
    predmetId,
    'JavaScript',
    'online',
    'Zoom'
  );

  const zahteve = termin.najdiCakajoceZahteve(tutorId);

  assert.equal(zahteve.length, 1);
  assert.equal(zahteve[0].student_ime, 'Miha');
  assert.equal(zahteve[0].predmet_naziv, 'Programiranje');
});

test('vrne potrjen termin samo za pravega tutorja', () => {
  const rezultat = termin.ustvariDostopnost(
    tutorId, '2099-05-10', '10:00', '11:00'
  );

  const id = rezultat.lastInsertRowid;

  termin.oddajZahtevo(
    id, studentId, predmetId, 'JavaScript', 'online', 'Zoom'
  );

  termin.potrdiZahtevo(id, tutorId);

  assert.ok(termin.najdiPotrjenTermin(id, tutorId));
  assert.equal(termin.najdiPotrjenTermin(id, studentId), undefined);
});

test('vrne potrjene termine tutorja', () => {
  const rezultat = termin.ustvariDostopnost(
    tutorId, '2099-05-10', '10:00', '11:00'
  );

  const id = rezultat.lastInsertRowid;

  termin.oddajZahtevo(
    id, studentId, predmetId, 'JavaScript', 'online', 'Zoom'
  );

  termin.potrdiZahtevo(id, tutorId);

  const potrjeni = termin.najdiPotrjeneTermineTutorja(tutorId);

  assert.equal(potrjeni.length, 1);
  assert.equal(potrjeni[0].student_ime, 'Miha');
});

test('pravilno prepozna pozno odpoved', () => {
  assert.equal(
    termin.izracunajPoznoOdpoved('2000-01-01', '10:00'),
    true
  );
});

test('obvestila lahko označimo kot prebrana', () => {
  const obvestilo = require('../models/obvestilo');

  obvestilo.ustvari(tutorId, 'Testno obvestilo');

  assert.equal(obvestilo.najdiNeprebrana(tutorId).length, 1);

  obvestilo.oznaciVsaPrebrana(tutorId);

  assert.equal(obvestilo.najdiNeprebrana(tutorId).length, 0);
});
