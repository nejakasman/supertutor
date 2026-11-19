
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const viewsPath = path.join(__dirname, '..', 'views');

function izrisiPredlogo(ime, podatki) {
    const datoteka = path.join(viewsPath, ime);

    return ejs.render(
        fs.readFileSync(datoteka, 'utf8'),
        podatki
    );
}

test('obstajajo vse glavne EJS-predloge', () => {
    const predloge = [
        'prijava.ejs',
        'registracija.ejs',
        'prosti-termini.ejs',
        'tutor-dostopnost.ejs'
    ];

    for (const predloga of predloge) {
        assert.ok(fs.existsSync(path.join(viewsPath, predloga)));
    }
});

test('pravilno izriše obrazec za prijavo', () => {
    const html = izrisiPredlogo('prijava.ejs', {
        napaka: null
    });

    assert.match(html, /<h1>Prijava<\/h1>/);
    assert.match(html, /action="\/prijava"/);
    assert.match(html, /name="email"/);
    assert.match(html, /name="geslo"/);
    assert.match(html, /type="password"/);
});

test('pravilno prikaže napako pri prijavi', () => {
    const html = izrisiPredlogo('prijava.ejs', {
        napaka: 'Napačni podatki za prijavo'
    });

    assert.match(html, /Napačni podatki za prijavo/);
});

test('pravilno izriše obrazec za registracijo', () => {
    const html = izrisiPredlogo('registracija.ejs', {
        napaka: null,
        podatki: {
            ime: 'Ana',
            priimek: 'Novak',
            email: 'ana@example.com',
            smer: 'Telekomunikacije'
        }
    });

    assert.match(html, /<h1>Registracija<\/h1>/);
    assert.match(html, /name="ime"/);
    assert.match(html, /name="priimek"/);
    assert.match(html, /name="email"/);
    assert.match(html, /name="geslo2"/);
    assert.match(html, /Ana/);
    assert.match(html, /ana@example\.com/);
    assert.match(html, /selected/);
});

test('pravilno prikaže proste termine tutorja', () => {
    const html = izrisiPredlogo('prosti-termini.ejs', {
        tutor: {
            ime: 'Ana',
            priimek: 'Novak'
        },
        termini: [
            {
                id: 1,
                datum: '2026-12-01',
                zacetek: '10:00',
                konec: '11:00'
            }
        ]
    });

    assert.match(html, /Ana Novak/);
    assert.match(html, /2026-12-01/);
    assert.match(html, /10:00/);
    assert.match(html, /11:00/);
    assert.match(html, /\/student\/zahteva\/1/);
});
