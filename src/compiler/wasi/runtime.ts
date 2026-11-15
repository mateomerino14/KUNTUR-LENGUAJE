import {
  divisionByZeroMessage,
  emptyIndexMessage,
  emptyListPopMessage,
  indexOutOfRangeMessage,
  invalidNumberMessage,
  missingKeyMessage,
  negativeRootMessage,
  noMoreInputMessage,
  notDeclaredMessage,
  reversedRandomMessage,
  tooDeepMessage,
  tooManyStepsMessage,
  undeclaredAssignmentMessage,
  zeroStepMessage,
} from '../../errors/messages.js';
import type {ValueType} from '../wasm/instructions.js';
import type {FunctionSignature} from '../wasm/module.js';

// Direcciones fijas al inicio de la memoria; la dirección 0 queda libre para representar "ningún objeto"
export const LAYOUT = {
  ioVector: 16,
  written: 24,
  fdStat: 32,
  random: 56,
  digits: 64,
  trueObject: 96,
  falseObject: 104,
  reservedEnd: 112,
} as const;

// Cada objeto empieza con una etiqueta que dice su tipo
export const TAGS = {
  number: 1,
  text: 2,
  list: 3,
  boolean: 4,
  dict: 5,
  record: 6,
} as const;

export const TEXT_HEADER_SIZE = 8;
export const WASI_MODULE = 'wasi_snapshot_preview1';

export const WASI_IMPORTS: Record<string, FunctionSignature> = {
  fd_write: {params: ['i32', 'i32', 'i32', 'i32'], results: ['i32']},
  fd_read: {params: ['i32', 'i32', 'i32', 'i32'], results: ['i32']},
  fd_fdstat_get: {params: ['i32', 'i32'], results: ['i32']},
  random_get: {params: ['i32', 'i32'], results: ['i32']},
  proc_exit: {params: ['i32'], results: []},
};

export interface RuntimeGlobal {
  name: string;
  type: ValueType;
  initial: number;
}

export interface RuntimeFunction {
  name: string;
  params: [string, ValueType][];
  results: ValueType[];
  locals: [string, ValueType][];
  body: string;
}

export const RUNTIME_GLOBALS: RuntimeGlobal[] = [
  {name: 'heap', type: 'i32', initial: 0},
  {name: 'lines', type: 'i32', initial: 0},
  {name: 'in_buf', type: 'i32', initial: 0},
  {name: 'in_pos', type: 'i32', initial: 0},
  {name: 'in_len', type: 'i32', initial: 0},
  {name: 'in_eof', type: 'i32', initial: 0},
  // -1: todavía no se sabe si la entrada es una terminal
  {name: 'echo', type: 'i32', initial: -1},
  // Resultado de \`scale_exact\`: un número representado como la suma de dos f64 (double-double)
  {name: 'dd_hi', type: 'f64', initial: 0},
  {name: 'dd_lo', type: 'f64', initial: 0},
];

const stdout = 1;
const stderr = 2;
const inputChunk = 4096;
const lineChunk = 64;
const twoToMinus53 = 1.1102230246251565e-16;

type Piece = string | {arg: string; kind: 'number' | 'text'};

// Marca que reemplaza una parte variable al pedir un mensaje, para después cortarlo en piezas
const marker = (index: number): string => `\u0000${index}\u0000`;

// Corta un mensaje en piezas fijas y argumentos, usando las marcas como separadores
const messagePieces = (message: string, args: Piece[]): Piece[] => {
  const pieces: Piece[] = [];
  message.split('\u0000').forEach((part, index) => {
    if (index % 2 === 0) {
      if (part !== '') {
        pieces.push(part);
      }
    }
    else {
      pieces.push(args[Number(part)]);
    }
  });
  return pieces;
};

// Escribe las instrucciones que mandan cada pieza del mensaje a la salida de errores
const writePieces = (pieces: Piece[]): string => pieces.map((piece) => {
  if (typeof piece === 'string') {
    return `(call $write_text (i32.const ${stderr}) (text.const ${JSON.stringify(piece)}))`;
  }
  if (piece.kind === 'number') {
    return `(call $write_text (i32.const ${stderr}) (call $number_to_text (local.get ${piece.arg})))`;
  }
  return `(call $write_text (i32.const ${stderr}) (local.get ${piece.arg}))`;
}).join('\n');

// Crea una función que informa un error de ejecución con su línea y columna y termina el programa
const failFunction = (name: string, params: [string, ValueType][], pieces: Piece[], prelude = ''): RuntimeFunction => ({
  name,
  params: [...params, ['$line', 'i32'], ['$column', 'i32']],
  results: [],
  locals: [],
  body: `
    ${prelude}
    (call $fail_begin (local.get $line) (local.get $column))
    ${writePieces(pieces)}
    (call $fail_end)`,
});

const numberArg = (arg: string): Piece => ({arg, kind: 'number'});
const textArg = (arg: string): Piece => ({arg, kind: 'text'});

// Funciones que informan cada error de ejecución, armadas con los mismos mensajes del intérprete
const failFunctions = (maxSteps: number): RuntimeFunction[] => [
  failFunction('fail_division_by_zero', [], [divisionByZeroMessage]),
  failFunction('fail_zero_step', [], [zeroStepMessage]),
  failFunction('fail_too_many_steps', [], [tooManyStepsMessage(maxSteps)]),
  failFunction('fail_no_more_input', [], [noMoreInputMessage]),
  failFunction('fail_empty_pop', [], [emptyListPopMessage]),
  failFunction('fail_too_deep', [['$name', 'i32']], messagePieces(tooDeepMessage(marker(0)), [textArg('$name')])),
  failFunction('fail_not_declared', [['$name', 'i32']], messagePieces(notDeclaredMessage(marker(0)), [textArg('$name')])),
  failFunction('fail_assign_not_declared', [['$name', 'i32']], messagePieces(undeclaredAssignmentMessage(marker(0)), [textArg('$name')])),
  failFunction('fail_empty_index', [['$index', 'f64']], messagePieces(emptyIndexMessage(marker(0)), [numberArg('$index')])),
  {
    ...failFunction(
      'fail_index_range',
      [['$index', 'f64'], ['$length', 'f64']],
      messagePieces(indexOutOfRangeMessage(marker(0), marker(1), marker(2)), [numberArg('$index'), numberArg('$length'), numberArg('$last')]),
      '(local.set $last (f64.sub (local.get $length) (f64.const 1)))',
    ),
    locals: [['$last', 'f64']],
  },
  failFunction('fail_missing_key', [['$quoted', 'i32']], messagePieces(missingKeyMessage(marker(0)), [textArg('$quoted')])),
  failFunction('fail_invalid_number', [['$quoted', 'i32']], messagePieces(invalidNumberMessage(marker(0)), [textArg('$quoted')])),
  failFunction('fail_negative_root', [['$number', 'f64']], messagePieces(negativeRootMessage(marker(0)), [numberArg('$number')])),
  failFunction(
    'fail_reversed_random',
    [['$high', 'f64'], ['$low', 'f64']],
    messagePieces(reversedRandomMessage(marker(0), marker(1)), [numberArg('$high'), numberArg('$low')]),
  ),
];

// Arma una función del runtime a partir de su firma escrita como en WAT
const fn = (name: string, params: string, results: string, locals: string, body: string): RuntimeFunction => {
  const pairs = (text: string): [string, ValueType][] => {
    if (text.trim() === '') {
      return [];
    }
    return text.trim().split(/\s*,\s*/).map((pair) => {
      const [variable, type] = pair.split(/\s+/);
      return [variable, type as ValueType];
    });
  };
  const resultTypes = results.trim().split(/\s+/).filter((type) => type !== '') as ValueType[];
  return {name, params: pairs(params), results: resultTypes, locals: pairs(locals), body};
};

const coreFunctions: RuntimeFunction[] = [
  // Memoria: reserva bloques alineados a 8 bytes y agranda la memoria cuando hace falta; nunca libera
  fn('alloc', '$size i32', 'i32', '$ptr i32, $end i32, $available i32', `
    (local.set $ptr (i32.and (i32.add (global.get $heap) (i32.const 7)) (i32.const -8)))
    (local.set $end (i32.add (local.get $ptr) (local.get $size)))
    (local.set $available (i32.shl (memory.size) (i32.const 16)))
    (if (i32.gt_u (local.get $end) (local.get $available))
      (then
        (if (i32.eq
              (memory.grow (i32.shr_u (i32.add (i32.sub (local.get $end) (local.get $available)) (i32.const 65535)) (i32.const 16)))
              (i32.const -1))
          (then (call $fail_out_of_memory)))))
    (global.set $heap (local.get $end))
    (local.get $ptr)`),
  fn('fail_out_of_memory', '', '', '', `
    (call $write_text (i32.const ${stderr}) (text.const "Error de ejecución: se acabó la memoria del programa.\\n"))
    (call $proc_exit (i32.const 1))`),

  // Textos: [etiqueta][largo en bytes][bytes UTF-8]
  fn('text_new', '$len i32', 'i32', '$t i32', `
    (local.set $t (call $alloc (i32.add (local.get $len) (i32.const ${TEXT_HEADER_SIZE}))))
    (i32.store (local.get $t) (i32.const ${TAGS.text}))
    (i32.store offset=4 (local.get $t) (local.get $len))
    (local.get $t)`),
  fn('text_len', '$t i32', 'i32', '', '(i32.load offset=4 (local.get $t))'),
  fn('text_literal', '$offset i32, $len i32', 'i32', '', `(i32.sub (local.get $offset) (i32.const ${TEXT_HEADER_SIZE}))`),
  fn('text_concat', '$a i32, $b i32', 'i32', '$la i32, $lb i32, $t i32', `
    (local.set $la (call $text_len (local.get $a)))
    (local.set $lb (call $text_len (local.get $b)))
    (local.set $t (call $text_new (i32.add (local.get $la) (local.get $lb))))
    (memory.copy (i32.add (local.get $t) (i32.const 8)) (i32.add (local.get $a) (i32.const 8)) (local.get $la))
    (memory.copy (i32.add (i32.add (local.get $t) (i32.const 8)) (local.get $la)) (i32.add (local.get $b) (i32.const 8)) (local.get $lb))
    (local.get $t)`),
  fn('text_compare', '$a i32, $b i32', 'i32', '$la i32, $lb i32, $min i32, $i i32, $ca i32, $cb i32', `
    (local.set $la (call $text_len (local.get $a)))
    (local.set $lb (call $text_len (local.get $b)))
    (local.set $min (select (local.get $la) (local.get $lb) (i32.lt_u (local.get $la) (local.get $lb))))
    (block $done
      (loop $next
        (br_if $done (i32.ge_u (local.get $i) (local.get $min)))
        (local.set $ca (i32.load8_u offset=8 (i32.add (local.get $a) (local.get $i))))
        (local.set $cb (i32.load8_u offset=8 (i32.add (local.get $b) (local.get $i))))
        (if (i32.lt_u (local.get $ca) (local.get $cb)) (then (return (i32.const -1))))
        (if (i32.gt_u (local.get $ca) (local.get $cb)) (then (return (i32.const 1))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $next)))
    (if (i32.lt_u (local.get $la) (local.get $lb)) (then (return (i32.const -1))))
    (if (i32.gt_u (local.get $la) (local.get $lb)) (then (return (i32.const 1))))
    (i32.const 0)`),
  // Largo como lo cuenta JavaScript: cada carácter fuera del plano básico ocupa dos unidades
  fn('utf16_length', '$t i32', 'i32', '$i i32, $len i32, $count i32, $byte i32', `
    (local.set $len (call $text_len (local.get $t)))
    (block $done
      (loop $next
        (br_if $done (i32.ge_u (local.get $i) (local.get $len)))
        (local.set $byte (i32.load8_u offset=8 (i32.add (local.get $t) (local.get $i))))
        (if (i32.ne (i32.and (local.get $byte) (i32.const 192)) (i32.const 128))
          (then (local.set $count (i32.add (local.get $count) (i32.const 1)))))
        (if (i32.ge_u (local.get $byte) (i32.const 240))
          (then (local.set $count (i32.add (local.get $count) (i32.const 1)))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $next)))
    (local.get $count)`),
  fn('char_size', '$byte i32', 'i32', '', `
    (if (result i32) (i32.lt_u (local.get $byte) (i32.const 128))
      (then (i32.const 1))
      (else
        (if (result i32) (i32.lt_u (local.get $byte) (i32.const 224))
          (then (i32.const 2))
          (else (select (i32.const 3) (i32.const 4) (i32.lt_u (local.get $byte) (i32.const 240)))))))`),
  fn('length', '$obj i32', 'f64', '', `
    (if (result f64) (i32.eq (i32.load (local.get $obj)) (i32.const ${TAGS.text}))
      (then (f64.convert_i32_u (call $utf16_length (local.get $obj))))
      (else (f64.convert_i32_u (i32.load offset=4 (call $list_view (local.get $obj))))))`),
  fn('list_view', '$obj i32', 'i32', '', `
    (select (i32.load offset=4 (local.get $obj)) (local.get $obj) (i32.eq (i32.load (local.get $obj)) (i32.const ${TAGS.dict})))`),
  fn('text_at', '$t i32, $index f64, $line i32, $column i32', 'i32', '$target i32, $pos i32, $unit i32, $size i32, $units i32, $result i32', `
    (local.set $target (call $check_index (local.get $index) (call $utf16_length (local.get $t)) (local.get $line) (local.get $column)))
    (block $found
      (loop $next
        (local.set $size (call $char_size (i32.load8_u offset=8 (i32.add (local.get $t) (local.get $pos)))))
        (local.set $units (select (i32.const 2) (i32.const 1) (i32.eq (local.get $size) (i32.const 4))))
        (br_if $found (i32.lt_u (local.get $target) (i32.add (local.get $unit) (local.get $units))))
        (local.set $unit (i32.add (local.get $unit) (local.get $units)))
        (local.set $pos (i32.add (local.get $pos) (local.get $size)))
        (br $next)))
    (local.set $result (call $text_new (local.get $size)))
    (memory.copy (i32.add (local.get $result) (i32.const 8)) (i32.add (i32.add (local.get $t) (i32.const 8)) (local.get $pos)) (local.get $size))
    (local.get $result)`),
  fn('check_index', '$index f64, $length i32, $line i32, $column i32', 'i32', '', `
    (if (i32.eqz (local.get $length))
      (then (call $fail_empty_index (local.get $index) (local.get $line) (local.get $column))))
    (if (i32.or (f64.lt (local.get $index) (f64.const 0)) (f64.ge (local.get $index) (f64.convert_i32_u (local.get $length))))
      (then (call $fail_index_range (local.get $index) (f64.convert_i32_u (local.get $length)) (local.get $line) (local.get $column))))
    (i32.trunc_f64_u (local.get $index))`),

  // Listas: [etiqueta][largo][capacidad][dirección de los elementos]; cada elemento es la dirección de un objeto
  fn('list_new', '', 'i32', '$l i32', `
    (local.set $l (call $alloc (i32.const 16)))
    (i32.store (local.get $l) (i32.const ${TAGS.list}))
    (i32.store offset=4 (local.get $l) (i32.const 0))
    (i32.store offset=8 (local.get $l) (i32.const 0))
    (i32.store offset=12 (local.get $l) (i32.const 0))
    (local.get $l)`),
  fn('list_item', '$l i32, $i i32', 'i32', '', `
    (i32.load (i32.add (i32.load offset=12 (local.get $l)) (i32.shl (local.get $i) (i32.const 2))))`),
  fn('list_push', '$l i32, $value i32', '', '$len i32, $cap i32, $data i32', `
    (local.set $len (i32.load offset=4 (local.get $l)))
    (local.set $cap (i32.load offset=8 (local.get $l)))
    (if (i32.eq (local.get $len) (local.get $cap))
      (then
        (local.set $cap (select (i32.shl (local.get $cap) (i32.const 1)) (i32.const 4) (local.get $cap)))
        (local.set $data (call $alloc (i32.shl (local.get $cap) (i32.const 2))))
        (memory.copy (local.get $data) (i32.load offset=12 (local.get $l)) (i32.shl (local.get $len) (i32.const 2)))
        (i32.store offset=12 (local.get $l) (local.get $data))
        (i32.store offset=8 (local.get $l) (local.get $cap))))
    (i32.store (i32.add (i32.load offset=12 (local.get $l)) (i32.shl (local.get $len) (i32.const 2))) (local.get $value))
    (i32.store offset=4 (local.get $l) (i32.add (local.get $len) (i32.const 1)))`),
  fn('list_get', '$l i32, $index f64, $line i32, $column i32', 'i32', '', `
    (call $list_item (local.get $l)
      (call $check_index (local.get $index) (i32.load offset=4 (local.get $l)) (local.get $line) (local.get $column)))`),
  fn('list_set', '$l i32, $index f64, $value i32, $line i32, $column i32', '', '', `
    (i32.store
      (i32.add (i32.load offset=12 (local.get $l))
        (i32.shl (call $check_index (local.get $index) (i32.load offset=4 (local.get $l)) (local.get $line) (local.get $column)) (i32.const 2)))
      (local.get $value))`),
  fn('list_pop', '$l i32, $line i32, $column i32', 'i32', '$len i32', `
    (local.set $len (i32.load offset=4 (local.get $l)))
    (if (i32.eqz (local.get $len)) (then (call $fail_empty_pop (local.get $line) (local.get $column))))
    (local.set $len (i32.sub (local.get $len) (i32.const 1)))
    (i32.store offset=4 (local.get $l) (local.get $len))
    (call $list_item (local.get $l) (local.get $len))`),
  fn('list_append_all', '$target i32, $source i32', '', '$i i32', `
    (block $done
      (loop $next
        (br_if $done (i32.ge_u (local.get $i) (i32.load offset=4 (local.get $source))))
        (call $list_push (local.get $target) (call $list_item (local.get $source) (local.get $i)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $next)))`),
  fn('list_concat', '$a i32, $b i32', 'i32', '$r i32', `
    (local.set $r (call $list_new))
    (call $list_append_all (local.get $r) (local.get $a))
    (call $list_append_all (local.get $r) (local.get $b))
    (local.get $r)`),

  // Diccionarios: una lista de claves y otra de valores, en el orden en que se agregaron
  fn('dict_new', '', 'i32', '$d i32', `
    (local.set $d (call $alloc (i32.const 16)))
    (i32.store (local.get $d) (i32.const ${TAGS.dict}))
    (i32.store offset=4 (local.get $d) (call $list_new))
    (i32.store offset=8 (local.get $d) (call $list_new))
    (local.get $d)`),
  fn('dict_find', '$d i32, $key i32', 'i32', '$keys i32, $i i32', `
    (local.set $keys (i32.load offset=4 (local.get $d)))
    (block $done
      (loop $next
        (br_if $done (i32.ge_u (local.get $i) (i32.load offset=4 (local.get $keys))))
        (if (i32.eqz (call $text_compare (call $list_item (local.get $keys) (local.get $i)) (local.get $key)))
          (then (return (local.get $i))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $next)))
    (i32.const -1)`),
  fn('dict_get', '$d i32, $key i32, $line i32, $column i32', 'i32', '$i i32', `
    (local.set $i (call $dict_find (local.get $d) (local.get $key)))
    (if (i32.lt_s (local.get $i) (i32.const 0))
      (then (call $fail_missing_key (call $json_quote (local.get $key)) (local.get $line) (local.get $column))))
    (call $list_item (i32.load offset=8 (local.get $d)) (local.get $i))`),
  fn('dict_set', '$d i32, $key i32, $value i32', '', '$i i32', `
    (local.set $i (call $dict_find (local.get $d) (local.get $key)))
    (if (i32.lt_s (local.get $i) (i32.const 0))
      (then
        (call $list_push (i32.load offset=4 (local.get $d)) (local.get $key))
        (call $list_push (i32.load offset=8 (local.get $d)) (local.get $value))
        (return)))
    (i32.store
      (i32.add (i32.load offset=12 (i32.load offset=8 (local.get $d))) (i32.shl (local.get $i) (i32.const 2)))
      (local.get $value))`),
  fn('dict_has', '$d i32, $key i32', 'i32', '', '(i32.ge_s (call $dict_find (local.get $d) (local.get $key)) (i32.const 0))'),
  fn('dict_keys', '$d i32', 'i32', '$r i32', `
    (local.set $r (call $list_new))
    (call $list_append_all (local.get $r) (i32.load offset=4 (local.get $d)))
    (local.get $r)`),
  fn('dict_equal', '$a i32, $b i32', 'i32', '$keys i32, $i i32, $j i32', `
    (local.set $keys (i32.load offset=4 (local.get $a)))
    (if (i32.ne (i32.load offset=4 (local.get $keys)) (i32.load offset=4 (i32.load offset=4 (local.get $b))))
      (then (return (i32.const 0))))
    (block $done
      (loop $next
        (br_if $done (i32.ge_u (local.get $i) (i32.load offset=4 (local.get $keys))))
        (local.set $j (call $dict_find (local.get $b) (call $list_item (local.get $keys) (local.get $i))))
        (if (i32.lt_s (local.get $j) (i32.const 0)) (then (return (i32.const 0))))
        (if (i32.eqz (call $values_equal
              (call $list_item (i32.load offset=8 (local.get $a)) (local.get $i))
              (call $list_item (i32.load offset=8 (local.get $b)) (local.get $j))))
          (then (return (i32.const 0))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $next)))
    (i32.const 1)`),
  fn('dict_to_text', '$d i32', 'i32', '', `
    (call $text_concat
      (call $text_concat (text.const "{") (call $entries_to_text (local.get $d) (i32.const 1)))
      (text.const "}"))`),
  fn('entries_to_text', '$d i32, $quote i32', 'i32', '$keys i32, $parts i32, $i i32, $key i32', `
    (local.set $keys (i32.load offset=4 (local.get $d)))
    (local.set $parts (call $list_new))
    (block $done
      (loop $next
        (br_if $done (i32.ge_u (local.get $i) (i32.load offset=4 (local.get $keys))))
        (call $list_push (local.get $parts)
          (call $text_concat
            (call $text_concat
              (select (call $json_quote (local.tee $key (call $list_item (local.get $keys) (local.get $i)))) (local.get $key) (local.get $quote))
              (text.const ": "))
            (call $stringify (call $list_item (i32.load offset=8 (local.get $d)) (local.get $i)) (i32.const 1))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $next)))
    (call $join (local.get $parts) (text.const ", "))`),

  // Registros: como un diccionario cuyas claves son los campos, más el nombre del registro
  fn('record_new', '$name i32', 'i32', '$r i32', `
    (local.set $r (call $alloc (i32.const 16)))
    (i32.store (local.get $r) (i32.const ${TAGS.record}))
    (i32.store offset=4 (local.get $r) (call $list_new))
    (i32.store offset=8 (local.get $r) (call $list_new))
    (i32.store offset=12 (local.get $r) (local.get $name))
    (local.get $r)`),
  fn('record_get', '$r i32, $field i32', 'i32', '', `
    (call $list_item (i32.load offset=8 (local.get $r)) (call $dict_find (local.get $r) (local.get $field)))`),
  fn('record_set', '$r i32, $field i32, $value i32', '', '', '(call $dict_set (local.get $r) (local.get $field) (local.get $value))'),
  fn('record_to_text', '$r i32', 'i32', '', `
    (call $text_concat
      (call $text_concat
        (call $text_concat (i32.load offset=12 (local.get $r)) (text.const "("))
        (call $entries_to_text (local.get $r) (i32.const 0)))
      (text.const ")"))`),

  // Cajas: los números van en un objeto propio y los valores lógicos son dos objetos fijos
  fn('box_number', '$x f64', 'i32', '$p i32', `
    (local.set $p (call $alloc (i32.const 16)))
    (i32.store (local.get $p) (i32.const ${TAGS.number}))
    (f64.store offset=8 (local.get $p) (local.get $x))
    (local.get $p)`),
  fn('unbox_number', '$p i32', 'f64', '', '(f64.load offset=8 (local.get $p))'),
  fn('box_bool', '$b i32', 'i32', '', `(select (i32.const ${LAYOUT.trueObject}) (i32.const ${LAYOUT.falseObject}) (local.get $b))`),
  fn('unbox_bool', '$p i32', 'i32', '', '(i32.load offset=4 (local.get $p))'),

  // Igualdad profunda, como la del intérprete: las listas se comparan elemento por elemento
  fn('values_equal', '$a i32, $b i32', 'i32', '$tag i32, $i i32, $len i32', `
    (if (i32.eq (local.get $a) (local.get $b)) (then (return (i32.const 1))))
    (local.set $tag (i32.load (local.get $a)))
    (if (i32.ne (local.get $tag) (i32.load (local.get $b))) (then (return (i32.const 0))))
    (if (i32.eq (local.get $tag) (i32.const ${TAGS.number}))
      (then (return (f64.eq (f64.load offset=8 (local.get $a)) (f64.load offset=8 (local.get $b))))))
    (if (i32.eq (local.get $tag) (i32.const ${TAGS.text}))
      (then (return (i32.eqz (call $text_compare (local.get $a) (local.get $b))))))
    (if (i32.eq (local.get $tag) (i32.const ${TAGS.boolean}))
      (then (return (i32.eq (i32.load offset=4 (local.get $a)) (i32.load offset=4 (local.get $b))))))
    (if (i32.eq (local.get $tag) (i32.const ${TAGS.dict}))
      (then (return (call $dict_equal (local.get $a) (local.get $b)))))
    (if (i32.eq (local.get $tag) (i32.const ${TAGS.record}))
      (then (return (i32.and
        (i32.eqz (call $text_compare (i32.load offset=12 (local.get $a)) (i32.load offset=12 (local.get $b))))
        (call $dict_equal (local.get $a) (local.get $b))))))
    (local.set $len (i32.load offset=4 (local.get $a)))
    (if (i32.ne (local.get $len) (i32.load offset=4 (local.get $b))) (then (return (i32.const 0))))
    (block $done
      (loop $next
        (br_if $done (i32.ge_u (local.get $i) (local.get $len)))
        (if (i32.eqz (call $values_equal (call $list_item (local.get $a) (local.get $i)) (call $list_item (local.get $b) (local.get $i))))
          (then (return (i32.const 0))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $next)))
    (i32.const 1)`),

  // Conversión a texto, igual que \`stringify\` del intérprete
  fn('bool_to_text', '$b i32', 'i32', '', '(select (text.const "verdadero") (text.const "falso") (local.get $b))'),
  fn('ref_to_text', '$obj i32', 'i32', '', '(call $stringify (local.get $obj) (i32.const 0))'),
  fn('stringify', '$obj i32, $nested i32', 'i32', '$tag i32, $parts i32, $i i32', `
    (local.set $tag (i32.load (local.get $obj)))
    (if (i32.eq (local.get $tag) (i32.const ${TAGS.text}))
      (then (return (select (call $json_quote (local.get $obj)) (local.get $obj) (local.get $nested)))))
    (if (i32.eq (local.get $tag) (i32.const ${TAGS.number}))
      (then (return (call $number_to_text (f64.load offset=8 (local.get $obj))))))
    (if (i32.eq (local.get $tag) (i32.const ${TAGS.boolean}))
      (then (return (call $bool_to_text (i32.load offset=4 (local.get $obj))))))
    (if (i32.eq (local.get $tag) (i32.const ${TAGS.dict}))
      (then (return (call $dict_to_text (local.get $obj)))))
    (if (i32.eq (local.get $tag) (i32.const ${TAGS.record}))
      (then (return (call $record_to_text (local.get $obj)))))
    (local.set $parts (call $list_new))
    (block $done
      (loop $next
        (br_if $done (i32.ge_u (local.get $i) (i32.load offset=4 (local.get $obj))))
        (call $list_push (local.get $parts) (call $stringify (call $list_item (local.get $obj) (local.get $i)) (i32.const 1)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $next)))
    (call $text_concat
      (call $text_concat (text.const "[") (call $join (local.get $parts) (text.const ", ")))
      (text.const "]"))`),
  fn('join', '$parts i32, $sep i32', 'i32', '$count i32, $i i32, $total i32, $t i32, $pos i32, $part i32, $slen i32', `
    (local.set $count (i32.load offset=4 (local.get $parts)))
    (local.set $slen (call $text_len (local.get $sep)))
    (block $done
      (loop $next
        (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
        (local.set $total (i32.add (local.get $total) (call $text_len (call $list_item (local.get $parts) (local.get $i)))))
        (if (i32.gt_u (local.get $i) (i32.const 0)) (then (local.set $total (i32.add (local.get $total) (local.get $slen)))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $next)))
    (local.set $t (call $text_new (local.get $total)))
    (local.set $pos (i32.add (local.get $t) (i32.const 8)))
    (local.set $i (i32.const 0))
    (block $done
      (loop $next
        (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
        (if (i32.gt_u (local.get $i) (i32.const 0))
          (then
            (memory.copy (local.get $pos) (i32.add (local.get $sep) (i32.const 8)) (local.get $slen))
            (local.set $pos (i32.add (local.get $pos) (local.get $slen)))))
        (local.set $part (call $list_item (local.get $parts) (local.get $i)))
        (memory.copy (local.get $pos) (i32.add (local.get $part) (i32.const 8)) (call $text_len (local.get $part)))
        (local.set $pos (i32.add (local.get $pos) (call $text_len (local.get $part))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $next)))
    (local.get $t)`),
  // Texto entre comillas con los escapes de JSON.stringify, para los textos dentro de listas y los mensajes
  fn('short_escape', '$b i32', 'i32', '', `
    (if (i32.eq (local.get $b) (i32.const 8)) (then (return (i32.const 98))))
    (if (i32.eq (local.get $b) (i32.const 9)) (then (return (i32.const 116))))
    (if (i32.eq (local.get $b) (i32.const 10)) (then (return (i32.const 110))))
    (if (i32.eq (local.get $b) (i32.const 12)) (then (return (i32.const 102))))
    (if (i32.eq (local.get $b) (i32.const 13)) (then (return (i32.const 114))))
    (i32.const 0)`),
  fn('escape_size', '$b i32', 'i32', '', `
    (if (i32.or (i32.eq (local.get $b) (i32.const 34)) (i32.eq (local.get $b) (i32.const 92))) (then (return (i32.const 2))))
    (if (i32.ge_u (local.get $b) (i32.const 32)) (then (return (i32.const 1))))
    (select (i32.const 2) (i32.const 6) (call $short_escape (local.get $b)))`),
  fn('hex_digit', '$v i32', 'i32', '', '(select (i32.add (local.get $v) (i32.const 48)) (i32.add (local.get $v) (i32.const 87)) (i32.lt_u (local.get $v) (i32.const 10)))'),
  fn('json_quote', '$t i32', 'i32', '$len i32, $i i32, $size i32, $r i32, $pos i32, $b i32, $letter i32', `
    (local.set $len (call $text_len (local.get $t)))
    (local.set $size (i32.const 2))
    (block $done
      (loop $next
        (br_if $done (i32.ge_u (local.get $i) (local.get $len)))
        (local.set $size (i32.add (local.get $size) (call $escape_size (i32.load8_u offset=8 (i32.add (local.get $t) (local.get $i))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $next)))
    (local.set $r (call $text_new (local.get $size)))
    (local.set $pos (i32.add (local.get $r) (i32.const 8)))
    (i32.store8 (local.get $pos) (i32.const 34))
    (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
    (local.set $i (i32.const 0))
    (block $done
      (loop $next
        (br_if $done (i32.ge_u (local.get $i) (local.get $len)))
        (local.set $b (i32.load8_u offset=8 (i32.add (local.get $t) (local.get $i))))
        (local.set $letter (call $short_escape (local.get $b)))
        (if (i32.or (i32.eq (local.get $b) (i32.const 34)) (i32.eq (local.get $b) (i32.const 92)))
          (then
            (i32.store8 (local.get $pos) (i32.const 92))
            (i32.store8 offset=1 (local.get $pos) (local.get $b))
            (local.set $pos (i32.add (local.get $pos) (i32.const 2))))
          (else
            (if (i32.ge_u (local.get $b) (i32.const 32))
              (then
                (i32.store8 (local.get $pos) (local.get $b))
                (local.set $pos (i32.add (local.get $pos) (i32.const 1))))
              (else
                (if (local.get $letter)
                  (then
                    (i32.store8 (local.get $pos) (i32.const 92))
                    (i32.store8 offset=1 (local.get $pos) (local.get $letter))
                    (local.set $pos (i32.add (local.get $pos) (i32.const 2))))
                  (else
                    (i32.store8 (local.get $pos) (i32.const 92))
                    (i32.store8 offset=1 (local.get $pos) (i32.const 117))
                    (i32.store8 offset=2 (local.get $pos) (i32.const 48))
                    (i32.store8 offset=3 (local.get $pos) (i32.const 48))
                    (i32.store8 offset=4 (local.get $pos) (call $hex_digit (i32.shr_u (local.get $b) (i32.const 4))))
                    (i32.store8 offset=5 (local.get $pos) (call $hex_digit (i32.and (local.get $b) (i32.const 15))))
                    (local.set $pos (i32.add (local.get $pos) (i32.const 6)))))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $next)))
    (i32.store8 (local.get $pos) (i32.const 34))
    (local.get $r)`),

  // Números: potencias de diez y escritura con la forma más corta que vuelve al mismo valor, como JavaScript
  fn('pow10', '$k i32', 'f64', '$r f64, $n i32', `
    (local.set $r (f64.const 1))
    (local.set $n (select (i32.sub (i32.const 0) (local.get $k)) (local.get $k) (i32.lt_s (local.get $k) (i32.const 0))))
    (block $done
      (loop $next
        (br_if $done (i32.eqz (local.get $n)))
        (local.set $r (f64.mul (local.get $r) (f64.const 10)))
        (local.set $n (i32.sub (local.get $n) (i32.const 1)))
        (br $next)))
    (select (f64.div (f64.const 1) (local.get $r)) (local.get $r) (i32.lt_s (local.get $k) (i32.const 0)))`),
  fn('scale', '$v f64, $s i32', 'f64', '', `
    (if (result f64) (i32.ge_s (local.get $s) (i32.const 0))
      (then (f64.mul (local.get $v) (call $pow10 (local.get $s))))
      (else (f64.div (local.get $v) (call $pow10 (i32.sub (i32.const 0) (local.get $s))))))`),
  fn('exponent10', '$a f64', 'i32', '$e i32', `
    (if (f64.ge (local.get $a) (f64.const 1))
      (then
        (block $done
          (loop $up
            (br_if $done (f64.lt (local.get $a) (call $pow10 (i32.add (local.get $e) (i32.const 1)))))
            (local.set $e (i32.add (local.get $e) (i32.const 1)))
            (br $up))))
      (else
        (loop $down
          (local.set $e (i32.sub (local.get $e) (i32.const 1)))
          (br_if $down (f64.lt (local.get $a) (call $pow10 (local.get $e)))))))
    (local.get $e)`),
  fn('put_byte', '$pos i32, $b i32', 'i32', '', `
    (i32.store8 (local.get $pos) (local.get $b))
    (i32.add (local.get $pos) (i32.const 1))`),
  fn('put_zeros', '$pos i32, $count i32', 'i32', '', `
    (block $done
      (loop $next
        (br_if $done (i32.le_s (local.get $count) (i32.const 0)))
        (local.set $pos (call $put_byte (local.get $pos) (i32.const 48)))
        (local.set $count (i32.sub (local.get $count) (i32.const 1)))
        (br $next)))
    (local.get $pos)`),
  fn('put_digits', '$pos i32, $from i32, $count i32', 'i32', '', `
    (memory.copy (local.get $pos) (i32.add (i32.const ${LAYOUT.digits}) (local.get $from)) (local.get $count))
    (i32.add (local.get $pos) (local.get $count))`),
  // Parte alta de un número cortado en dos mitades de 26 bits (Veltkamp), para multiplicar sin perder bits
  fn('split_high', '$x f64', 'f64', '$c f64', `
    (local.set $c (f64.mul (f64.const 134217729) (local.get $x)))
    (f64.sub (local.get $c) (f64.sub (local.get $c) (local.get $x)))`),
  // Error exacto de redondeo del producto a × b = p (Dekker)
  fn('product_error', '$a f64, $b f64, $p f64', 'f64', '$ah f64, $al f64, $bh f64, $bl f64', `
    (local.set $ah (call $split_high (local.get $a)))
    (local.set $al (f64.sub (local.get $a) (local.get $ah)))
    (local.set $bh (call $split_high (local.get $b)))
    (local.set $bl (f64.sub (local.get $b) (local.get $bh)))
    (f64.add
      (f64.add
        (f64.add (f64.sub (f64.mul (local.get $ah) (local.get $bh)) (local.get $p)) (f64.mul (local.get $ah) (local.get $bl)))
        (f64.mul (local.get $al) (local.get $bh)))
      (f64.mul (local.get $al) (local.get $bl)))`),
  // Calcula a × 10^s con unos 106 bits de precisión y lo deja en $dd_hi + $dd_lo; con s negativo divide
  fn('scale_exact', '$a f64, $s i32', '', '$hi f64, $lo f64, $f f64, $p f64, $q f64, $err f64, $sum f64, $chunk i32', `
    (local.set $hi (local.get $a))
    (block $done
      (loop $next
        (br_if $done (i32.ge_s (local.get $s) (i32.const 0)))
        (local.set $chunk (select (i32.const 22) (i32.sub (i32.const 0) (local.get $s)) (i32.lt_s (local.get $s) (i32.const -22))))
        (local.set $f (call $pow10 (local.get $chunk)))
        (local.set $q (f64.div (local.get $hi) (local.get $f)))
        (local.set $p (f64.mul (local.get $q) (local.get $f)))
        ;; Resto exacto de la división: hi - q × f, sumado a la parte baja que ya se tenía
        (local.set $err (f64.div
          (f64.add (f64.sub (f64.sub (local.get $hi) (local.get $p)) (call $product_error (local.get $q) (local.get $f) (local.get $p))) (local.get $lo))
          (local.get $f)))
        (local.set $sum (f64.add (local.get $q) (local.get $err)))
        (local.set $lo (f64.sub (local.get $err) (f64.sub (local.get $sum) (local.get $q))))
        (local.set $hi (local.get $sum))
        (local.set $s (i32.add (local.get $s) (local.get $chunk)))
        (br $next)))
    (block $done
      (loop $next
        (br_if $done (i32.le_s (local.get $s) (i32.const 0)))
        (local.set $chunk (select (i32.const 22) (local.get $s) (i32.gt_s (local.get $s) (i32.const 22))))
        (local.set $f (call $pow10 (local.get $chunk)))
        (local.set $p (f64.mul (local.get $hi) (local.get $f)))
        (local.set $err (f64.add (call $product_error (local.get $hi) (local.get $f) (local.get $p)) (f64.mul (local.get $lo) (local.get $f))))
        (local.set $sum (f64.add (local.get $p) (local.get $err)))
        (local.set $lo (f64.sub (local.get $err) (f64.sub (local.get $sum) (local.get $p))))
        (local.set $hi (local.get $sum))
        (local.set $s (i32.sub (local.get $s) (local.get $chunk)))
        (br $next)))
    (global.set $dd_hi (local.get $hi))
    (global.set $dd_lo (local.get $lo))`),
  fn('pow10_int', '$k i32', 'i64', '$r i64', `
    (local.set $r (i64.const 1))
    (block $done
      (loop $next
        (br_if $done (i32.le_s (local.get $k) (i32.const 0)))
        (local.set $r (i64.mul (local.get $r) (i64.const 10)))
        (local.set $k (i32.sub (local.get $k) (i32.const 1)))
        (br $next)))
    (local.get $r)`),
  // Distancia al siguiente número representable
  fn('ulp', '$a f64', 'f64', '', `
    (f64.sub (f64.reinterpret_i64 (i64.add (i64.reinterpret_f64 (local.get $a)) (i64.const 1))) (local.get $a))`),
  fn('number_to_text', '$x f64', 'i32',
    '$a f64, $neg i32, $e i32, $p i32, $s i32, $nh f64, $frac f64, $adjust f64, $limit f64, $digits i64, $rest i64, $k i32, $n i32, $t i32, $pos i32, $i i32, $exp i32', `
    (if (f64.ne (local.get $x) (local.get $x)) (then (return (text.const "NaN"))))
    (if (f64.eq (local.get $x) (f64.const 0)) (then (return (text.const "0"))))
    (local.set $neg (f64.lt (local.get $x) (f64.const 0)))
    (local.set $a (f64.abs (local.get $x)))
    (if (f64.eq (local.get $a) (f64.const inf))
      (then (return (select (text.const "-Infinity") (text.const "Infinity") (local.get $neg)))))
    (if (i32.and (f64.eq (f64.trunc (local.get $a)) (local.get $a)) (f64.lt (local.get $a) (f64.const 9007199254740992)))
      (then
        ;; Hasta 2^53 los enteros son exactos y se escriben con todas sus cifras
        (local.set $digits (i64.trunc_f64_u (local.get $a))))
      (else
        (local.set $e (call $exponent10 (local.get $a)))
        (local.set $p (i32.const 1))
        ;; Busca la menor cantidad de cifras que, leída de nuevo, da exactamente el mismo número
        (block $found
          (loop $try
            (local.set $s (i32.sub (i32.sub (local.get $p) (i32.const 1)) (local.get $e)))
            ;; Las cifras salen del producto exacto a × 10^s; el error se compara con media distancia al número vecino
            (call $scale_exact (local.get $a) (local.get $s))
            (local.set $nh (f64.nearest (global.get $dd_hi)))
            (local.set $frac (f64.add (f64.sub (global.get $dd_hi) (local.get $nh)) (global.get $dd_lo)))
            (local.set $adjust (f64.nearest (local.get $frac)))
            (local.set $digits (i64.add (i64.trunc_f64_s (local.get $nh)) (i64.trunc_f64_s (local.get $adjust))))
            (if (i64.ge_u (local.get $digits) (call $pow10_int (local.get $p)))
              (then
                (local.set $e (i32.add (local.get $e) (i32.const 1)))
                (br $try)))
            (local.set $limit (f64.mul (f64.mul (call $ulp (local.get $a)) (call $pow10 (local.get $s))) (f64.const 0.5)))
            (br_if $found (f64.lt (f64.abs (f64.sub (local.get $adjust) (local.get $frac))) (local.get $limit)))
            ;; En un empate exacto, la lectura redondea al vecino par: sirve si el número ya es par
            (br_if $found (i32.and
              (f64.eq (f64.abs (f64.sub (local.get $adjust) (local.get $frac))) (local.get $limit))
              (i64.eqz (i64.and (i64.reinterpret_f64 (local.get $a)) (i64.const 1)))))
            (br_if $found (i32.ge_u (local.get $p) (i32.const 17)))
            (local.set $p (i32.add (local.get $p) (i32.const 1)))
            (br $try)))))
    (block $stripped
      (loop $strip
        (br_if $stripped (i64.ne (i64.rem_u (local.get $digits) (i64.const 10)) (i64.const 0)))
        (local.set $digits (i64.div_u (local.get $digits) (i64.const 10)))
        (local.set $s (i32.sub (local.get $s) (i32.const 1)))
        (br $strip)))
    (local.set $rest (local.get $digits))
    (block $counted
      (loop $count
        (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (local.set $rest (i64.div_u (local.get $rest) (i64.const 10)))
        (br_if $counted (i64.eqz (local.get $rest)))
        (br $count)))
    (local.set $i (local.get $k))
    (block $written
      (loop $write
        (br_if $written (i32.eqz (local.get $i)))
        (local.set $i (i32.sub (local.get $i) (i32.const 1)))
        (i32.store8 offset=${LAYOUT.digits} (local.get $i) (i32.add (i32.const 48) (i32.wrap_i64 (i64.rem_u (local.get $digits) (i64.const 10)))))
        (local.set $digits (i64.div_u (local.get $digits) (i64.const 10)))
        (br $write)))
    ;; Las reglas de Number.prototype.toString: n es la posición del punto decimal
    (local.set $n (i32.sub (local.get $k) (local.get $s)))
    (local.set $t (call $text_new (i32.const 32)))
    (local.set $pos (i32.add (local.get $t) (i32.const 8)))
    (if (local.get $neg) (then (local.set $pos (call $put_byte (local.get $pos) (i32.const 45)))))
    (if (i32.and (i32.le_s (local.get $k) (local.get $n)) (i32.le_s (local.get $n) (i32.const 21)))
      (then
        (local.set $pos (call $put_digits (local.get $pos) (i32.const 0) (local.get $k)))
        (local.set $pos (call $put_zeros (local.get $pos) (i32.sub (local.get $n) (local.get $k)))))
      (else
        (if (i32.and (i32.gt_s (local.get $n) (i32.const 0)) (i32.le_s (local.get $n) (i32.const 21)))
          (then
            (local.set $pos (call $put_digits (local.get $pos) (i32.const 0) (local.get $n)))
            (local.set $pos (call $put_byte (local.get $pos) (i32.const 46)))
            (local.set $pos (call $put_digits (local.get $pos) (local.get $n) (i32.sub (local.get $k) (local.get $n)))))
          (else
            (if (i32.and (i32.gt_s (local.get $n) (i32.const -6)) (i32.le_s (local.get $n) (i32.const 0)))
              (then
                (local.set $pos (call $put_byte (local.get $pos) (i32.const 48)))
                (local.set $pos (call $put_byte (local.get $pos) (i32.const 46)))
                (local.set $pos (call $put_zeros (local.get $pos) (i32.sub (i32.const 0) (local.get $n))))
                (local.set $pos (call $put_digits (local.get $pos) (i32.const 0) (local.get $k))))
              (else
                (local.set $pos (call $put_digits (local.get $pos) (i32.const 0) (i32.const 1)))
                (if (i32.gt_s (local.get $k) (i32.const 1))
                  (then
                    (local.set $pos (call $put_byte (local.get $pos) (i32.const 46)))
                    (local.set $pos (call $put_digits (local.get $pos) (i32.const 1) (i32.sub (local.get $k) (i32.const 1))))))
                (local.set $pos (call $put_byte (local.get $pos) (i32.const 101)))
                (local.set $exp (i32.sub (local.get $n) (i32.const 1)))
                (local.set $pos (call $put_byte (local.get $pos) (select (i32.const 43) (i32.const 45) (i32.ge_s (local.get $exp) (i32.const 0)))))
                (local.set $exp (select (local.get $exp) (i32.sub (i32.const 0) (local.get $exp)) (i32.ge_s (local.get $exp) (i32.const 0))))
                (if (i32.ge_u (local.get $exp) (i32.const 100))
                  (then (local.set $pos (call $put_byte (local.get $pos) (i32.add (i32.const 48) (i32.div_u (local.get $exp) (i32.const 100)))))))
                (if (i32.ge_u (local.get $exp) (i32.const 10))
                  (then (local.set $pos (call $put_byte (local.get $pos) (i32.add (i32.const 48) (i32.rem_u (i32.div_u (local.get $exp) (i32.const 10)) (i32.const 10)))))))
                (local.set $pos (call $put_byte (local.get $pos) (i32.add (i32.const 48) (i32.rem_u (local.get $exp) (i32.const 10)))))))))))
    (i32.store offset=4 (local.get $t) (i32.sub (local.get $pos) (i32.add (local.get $t) (i32.const 8))))
    (local.get $t)`),
  // Lee un número escrito como -12 o 3.5, con espacios alrededor; cualquier otra forma es un error
  fn('is_space', '$b i32', 'i32', '', `
    (i32.or (i32.eq (local.get $b) (i32.const 32)) (i32.and (i32.ge_u (local.get $b) (i32.const 9)) (i32.le_u (local.get $b) (i32.const 13))))`),
  fn('byte_at', '$t i32, $i i32', 'i32', '', '(i32.load8_u offset=8 (i32.add (local.get $t) (local.get $i)))'),
  fn('is_digit', '$b i32', 'i32', '', '(i32.and (i32.ge_u (local.get $b) (i32.const 48)) (i32.le_u (local.get $b) (i32.const 57)))'),
  // Hasta 19 cifras caben exactas en un entero de 64 bits sin signo
  fn('parse_number', '$t i32, $line i32, $column i32', 'f64',
    '$start i32, $end i32, $i i32, $neg i32, $mant i64, $count i32, $whole i32, $fraction i32, $extra i32, $valid i32, $hi f64, $lo f64, $f f64, $q f64, $p f64', `
    (local.set $end (call $text_len (local.get $t)))
    (block $trimmed
      (loop $left
        (br_if $trimmed (i32.ge_u (local.get $start) (local.get $end)))
        (br_if $trimmed (i32.eqz (call $is_space (call $byte_at (local.get $t) (local.get $start)))))
        (local.set $start (i32.add (local.get $start) (i32.const 1)))
        (br $left)))
    (block $trimmed
      (loop $right
        (br_if $trimmed (i32.le_u (local.get $end) (local.get $start)))
        (br_if $trimmed (i32.eqz (call $is_space (call $byte_at (local.get $t) (i32.sub (local.get $end) (i32.const 1))))))
        (local.set $end (i32.sub (local.get $end) (i32.const 1)))
        (br $right)))
    (local.set $i (local.get $start))
    (if (i32.and (i32.lt_u (local.get $i) (local.get $end)) (i32.eq (call $byte_at (local.get $t) (local.get $i)) (i32.const 45)))
      (then
        (local.set $neg (i32.const 1))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))))
    (block $done
      (loop $next
        (br_if $done (i32.ge_u (local.get $i) (local.get $end)))
        (br_if $done (i32.eqz (call $is_digit (call $byte_at (local.get $t) (local.get $i)))))
        ;; Pasadas 19 cifras significativas, las demás solo multiplican por diez
        (if (i32.lt_u (local.get $count) (i32.const 19))
          (then
            (local.set $mant (call $add_digit (local.get $mant) (call $byte_at (local.get $t) (local.get $i)) (local.get $count)))
            (local.set $count (i32.add (local.get $count) (i32.ne (i64.eqz (local.get $mant)) (i32.const 1)))))
          (else (local.set $extra (i32.add (local.get $extra) (i32.const 1)))))
        (local.set $whole (i32.add (local.get $whole) (i32.const 1)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $next)))
    (local.set $valid (i32.gt_u (local.get $whole) (i32.const 0)))
    (if (i32.and (i32.lt_u (local.get $i) (local.get $end)) (i32.eq (call $byte_at (local.get $t) (local.get $i)) (i32.const 46)))
      (then
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (block $done
          (loop $next
            (br_if $done (i32.ge_u (local.get $i) (local.get $end)))
            (br_if $done (i32.eqz (call $is_digit (call $byte_at (local.get $t) (local.get $i)))))
            ;; Las cifras decimales después de la 19 significativa ya no cambian el valor de un f64
            (if (i32.lt_u (local.get $count) (i32.const 19))
              (then
                (local.set $mant (call $add_digit (local.get $mant) (call $byte_at (local.get $t) (local.get $i)) (local.get $count)))
                (local.set $count (i32.add (local.get $count) (i32.ne (i64.eqz (local.get $mant)) (i32.const 1))))
                (local.set $fraction (i32.add (local.get $fraction) (i32.const 1)))))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $next)))
        (local.set $valid (i32.and (local.get $valid) (i32.lt_u (local.get $start) (i32.sub (local.get $i) (i32.const 1)))))
        (local.set $valid (i32.and (local.get $valid) (i32.ne (call $byte_at (local.get $t) (i32.sub (local.get $i) (i32.const 1))) (i32.const 46))))))
    (if (i32.or (i32.eqz (local.get $valid)) (i32.ne (local.get $i) (local.get $end)))
      (then
        (call $fail_invalid_number (call $json_quote (local.get $t)) (local.get $line) (local.get $column))))
    ;; Cifras exactas como hi + lo, y una sola división con doble precisión
    (local.set $hi (f64.convert_i64_u (local.get $mant)))
    (local.set $lo (f64.convert_i64_s (i64.sub (local.get $mant) (i64.trunc_f64_u (local.get $hi)))))
    (if (local.get $fraction)
      (then
        (local.set $f (call $pow10 (local.get $fraction)))
        (local.set $q (f64.div (local.get $hi) (local.get $f)))
        (local.set $p (f64.mul (local.get $q) (local.get $f)))
        (local.set $hi (f64.add (local.get $q)
          (f64.div
            (f64.add (f64.sub (f64.sub (local.get $hi) (local.get $p)) (call $product_error (local.get $q) (local.get $f) (local.get $p))) (local.get $lo))
            (local.get $f)))))
      (else
        ;; Sin decimales: las cifras sobrantes de un entero largo se aplican con un producto de doble precisión
        (local.set $f (call $pow10 (local.get $extra)))
        (local.set $p (f64.mul (local.get $hi) (local.get $f)))
        (local.set $hi (f64.add (local.get $p)
          (f64.add (call $product_error (local.get $hi) (local.get $f) (local.get $p)) (f64.mul (local.get $lo) (local.get $f)))))))
    (select (f64.neg (local.get $hi)) (local.get $hi) (local.get $neg))`),
  // Agrega una cifra al final del entero
  fn('add_digit', '$mant i64, $byte i32, $count i32', 'i64', '', `
    (i64.add (i64.mul (local.get $mant) (i64.const 10)) (i64.extend_i32_u (i32.sub (local.get $byte) (i32.const 48))))`),
  // Salida: escribe en un descriptor de WASI hasta mandar todos los bytes
  fn('write', '$fd i32, $ptr i32, $len i32', '', '$sent i32', `
    (block $done
      (loop $next
        (br_if $done (i32.le_s (local.get $len) (i32.const 0)))
        (i32.store (i32.const ${LAYOUT.ioVector}) (local.get $ptr))
        (i32.store offset=4 (i32.const ${LAYOUT.ioVector}) (local.get $len))
        (br_if $done (call $fd_write (local.get $fd) (i32.const ${LAYOUT.ioVector}) (i32.const 1) (i32.const ${LAYOUT.written})))
        (local.set $sent (i32.load (i32.const ${LAYOUT.written})))
        (br_if $done (i32.eqz (local.get $sent)))
        (local.set $ptr (i32.add (local.get $ptr) (local.get $sent)))
        (local.set $len (i32.sub (local.get $len) (local.get $sent)))
        (br $next)))`),
  fn('write_text', '$fd i32, $t i32', '', '', '(call $write (local.get $fd) (i32.add (local.get $t) (i32.const 8)) (call $text_len (local.get $t)))'),
  // \`mostrar\` arma la línea en una pila de partes, porque sus argumentos pueden llamar a otro \`mostrar\`
  fn('line_start', '', '', '', `
    (if (i32.eqz (global.get $lines)) (then (global.set $lines (call $list_new))))
    (call $list_push (global.get $lines) (call $list_new))`),
  fn('append_part', '$text i32', '', '', `
    (call $list_push
      (call $list_item (global.get $lines) (i32.sub (i32.load offset=4 (global.get $lines)) (i32.const 1)))
      (local.get $text))`),
  fn('append_number', '$x f64', '', '', '(call $append_part (call $number_to_text (local.get $x)))'),
  fn('append_bool', '$b i32', '', '', '(call $append_part (call $bool_to_text (local.get $b)))'),
  fn('append_ref', '$obj i32', '', '', '(call $append_part (call $ref_to_text (local.get $obj)))'),
  fn('line_end', '', '', '$last i32', `
    (local.set $last (i32.sub (i32.load offset=4 (global.get $lines)) (i32.const 1)))
    (i32.store offset=4 (global.get $lines) (local.get $last))
    (call $write_text (i32.const ${stdout}) (call $join (call $list_item (global.get $lines) (local.get $last)) (text.const " ")))
    (call $write_text (i32.const ${stdout}) (text.const "\\n"))`),

  // Entrada: lee la entrada estándar por bloques y la entrega línea por línea
  fn('read_byte', '', 'i32', '$byte i32', `
    (if (i32.ge_u (global.get $in_pos) (global.get $in_len))
      (then
        (if (global.get $in_eof) (then (return (i32.const -1))))
        (if (i32.eqz (global.get $in_buf)) (then (global.set $in_buf (call $alloc (i32.const ${inputChunk})))))
        (i32.store (i32.const ${LAYOUT.ioVector}) (global.get $in_buf))
        (i32.store offset=4 (i32.const ${LAYOUT.ioVector}) (i32.const ${inputChunk}))
        (if (call $fd_read (i32.const 0) (i32.const ${LAYOUT.ioVector}) (i32.const 1) (i32.const ${LAYOUT.written}))
          (then
            (global.set $in_eof (i32.const 1))
            (return (i32.const -1))))
        (global.set $in_len (i32.load (i32.const ${LAYOUT.written})))
        (global.set $in_pos (i32.const 0))
        (if (i32.eqz (global.get $in_len))
          (then
            (global.set $in_eof (i32.const 1))
            (return (i32.const -1))))))
    (local.set $byte (i32.load8_u (i32.add (global.get $in_buf) (global.get $in_pos))))
    (global.set $in_pos (i32.add (global.get $in_pos) (i32.const 1)))
    (local.get $byte)`),
  // Si la entrada no es una terminal, la respuesta no se ve: se repite, igual que en la línea de comandos
  fn('echo_answers', '', 'i32', '', `
    (if (i32.lt_s (global.get $echo) (i32.const 0))
      (then
        (global.set $echo (i32.const 1))
        (if (i32.eqz (call $fd_fdstat_get (i32.const 0) (i32.const ${LAYOUT.fdStat})))
          (then
            (if (i32.eq (i32.load8_u (i32.const ${LAYOUT.fdStat})) (i32.const 2))
              (then (global.set $echo (i32.const 0))))))))
    (global.get $echo)`),
  fn('read_line', '$prompt i32, $line i32, $column i32', 'i32', '$buffer i32, $cap i32, $len i32, $byte i32, $found i32, $bigger i32, $t i32', `
    (call $write_text (i32.const ${stdout}) (local.get $prompt))
    (local.set $cap (i32.const ${lineChunk}))
    (local.set $buffer (call $alloc (local.get $cap)))
    (block $done
      (loop $next
        (local.set $byte (call $read_byte))
        (br_if $done (i32.lt_s (local.get $byte) (i32.const 0)))
        (if (i32.eq (local.get $byte) (i32.const 10))
          (then
            (local.set $found (i32.const 1))
            (br $done)))
        (if (i32.eq (local.get $len) (local.get $cap))
          (then
            (local.set $cap (i32.shl (local.get $cap) (i32.const 1)))
            (local.set $bigger (call $alloc (local.get $cap)))
            (memory.copy (local.get $bigger) (local.get $buffer) (local.get $len))
            (local.set $buffer (local.get $bigger))))
        (i32.store8 (i32.add (local.get $buffer) (local.get $len)) (local.get $byte))
        (local.set $len (i32.add (local.get $len) (i32.const 1)))
        (br $next)))
    (if (i32.and (i32.eqz (local.get $found)) (i32.eqz (local.get $len)))
      (then
        (call $write_text (i32.const ${stdout}) (text.const "\\n"))
        (call $fail_no_more_input (local.get $line) (local.get $column))))
    (if (i32.gt_u (local.get $len) (i32.const 0))
      (then
        (if (i32.eq (i32.load8_u (i32.add (local.get $buffer) (i32.sub (local.get $len) (i32.const 1)))) (i32.const 13))
          (then (local.set $len (i32.sub (local.get $len) (i32.const 1)))))))
    (local.set $t (call $text_new (local.get $len)))
    (memory.copy (i32.add (local.get $t) (i32.const 8)) (local.get $buffer) (local.get $len))
    (if (call $echo_answers)
      (then
        (call $write_text (i32.const ${stdout}) (local.get $t))
        (call $write_text (i32.const ${stdout}) (text.const "\\n"))))
    (local.get $t)`),

  // Azar y raíz cuadrada, con los mismos errores que las funciones propias del intérprete
  fn('random_int', '$min f64, $max f64, $line i32, $column i32', 'f64', '$r f64', `
    (if (f64.gt (local.get $min) (local.get $max))
      (then (call $fail_reversed_random (local.get $max) (local.get $min) (local.get $line) (local.get $column))))
    (drop (call $random_get (i32.const ${LAYOUT.random}) (i32.const 8)))
    (local.set $r (f64.mul (f64.convert_i64_u (i64.shr_u (i64.load (i32.const ${LAYOUT.random})) (i64.const 11))) (f64.const ${twoToMinus53})))
    (f64.add (local.get $min) (f64.floor (f64.mul (local.get $r) (f64.add (f64.sub (local.get $max) (local.get $min)) (f64.const 1)))))`),
  fn('square_root', '$x f64, $line i32, $column i32', 'f64', '', `
    (if (f64.lt (local.get $x) (f64.const 0))
      (then (call $fail_negative_root (local.get $x) (local.get $line) (local.get $column))))
    (f64.sqrt (local.get $x))`),

  // Errores: el mismo formato que \`formatDiagnostic\` sin el código fuente, en la salida de errores
  fn('fail_begin', '$line i32, $column i32', '', '', `
    (call $write_text (i32.const ${stderr}) (text.const "Error de ejecución en la línea "))
    (call $write_text (i32.const ${stderr}) (call $number_to_text (f64.convert_i32_s (local.get $line))))
    (call $write_text (i32.const ${stderr}) (text.const ", columna "))
    (call $write_text (i32.const ${stderr}) (call $number_to_text (f64.convert_i32_s (local.get $column))))
    (call $write_text (i32.const ${stderr}) (text.const ":\\n"))`),
  fn('fail_end', '', '', '', `
    (call $write_text (i32.const ${stderr}) (text.const "\\n"))
    (call $proc_exit (i32.const 1))`),
];

// Funciones del runtime independiente; el límite de pasos se escribe dentro de su mensaje
export const runtimeFunctions = (maxSteps: number): RuntimeFunction[] => [...coreFunctions, ...failFunctions(maxSteps)];
