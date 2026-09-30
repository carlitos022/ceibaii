import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProfile } from './account-profile';

const empty = { firstName: '', lastName: '', nationalId: '', ownerName: '' };
test('perfil opcional admite eliminar datos y preserva nombres', () => {
  assert.deepEqual(validateProfile(empty), empty);
  assert.deepEqual(validateProfile({ ...empty, firstName: '  Maria ', lastName: 'Rios' }), { ...empty, firstName: 'Maria', lastName: 'Rios' });
});
test('perfil no admite cambiar identificadores, permisos ni unidades', () => {
  for (const field of ['uid','rid','units','account']) assert.throws(() => validateProfile({ ...empty, [field]: 1 }));
});
test('valida cedula, tipos, limites y contenido', () => {
  assert.throws(() => validateProfile({ ...empty, nationalId: '123' }));
  assert.throws(() => validateProfile({ ...empty, firstName: 4 }));
  assert.throws(() => validateProfile({ ...empty, ownerName: '<script>' }));
  assert.throws(() => validateProfile({ ...empty, lastName: 'a'.repeat(121) }));
});
