require('@g-js-api/g.js');

let bits = 32;
let bin1 = Array(bits).fill(0).map(x => counter(x));
let bin2 = Array(bits).fill(0).map(x => counter(x));

bin1.forEach((x, i) => x.display(30 * i, 105));

// convert signed int to unsigned int binary value
// "remappables" are like functions in Geometry Dash that can take IDs as inputs inputs

let c2 = counter(-(2 ** 31 - 1));
let c3 = counter(0);
let c4 = counter(0);
c2.display(15, 15);
let signed_to_bin1 = remappable((int) => {
    for (let i = bin1.length - 1; i >= 0; i--) {
        // diff from c2 to int (int will be larger)
        c3.set(2 ** i);
		$.add(item_edit(c2.item, c3.item, c4.item, ITEM, ITEM, ITEM, EQ, ADD));
        let tcond = trigger_function(() => {
            bin1[bits - 1 - i].add(1);
            c2.add(2 ** i);
        });
		compare(c4, LESS_OR_EQ, counter(int, true), tcond);
        c3.reset();
		c4.reset();
    };
	c2.set(-(2 ** 31 - 1));
});
let num_to_bin2 = remappable((int) => {
	for (let i = bin2.length - 1; i >= 0; i--) {
		let tr = trigger_function(() => {
			counter(int, true).subtract(2 ** i);
			bin2[bits - 1 - i].set(1);
		});
		counter(int, true).if_is(SMALLER_THAN, 2 ** i, trigger_function(() => bin2[bits - 1 - i].set(0)));
		counter(int, true).if_is(EQUAL_TO, 2 ** i, tr);
		counter(int, true).if_is(LARGER_THAN, 2 ** i, tr);
	};
});
let right_shift1 = trigger_function(() => {
	for (let i = bin1.length - 1; i >= 0; i--) {
		let x = bin1[i];
		if (i == 0) {
			x.set(0);
			break;
		}
		x.set(bin1[i - 1]);
	};
});

let bin_to_num = remappable((out) => {
	for (let i = 0; i < bin1.length; i++) {
		bin1[i].if_is(EQUAL_TO, 1, trigger_function(() => counter(out, true).add(2 ** (bits - 1 - i))));
	}
});

let reset_bin1 = trigger_function(() => {
	for (let i = 0; i < bin1.length; i++) {
		bin1[i].reset();
	}
});

let reset_bin2 = trigger_function(() => {
	for (let i = 0; i < bin1.length; i++) {
		bin1[i].reset();
	}
});

let right_shift = (times) => {
	for (let i = 0; i < times; i++) {
		right_shift1.call();
	};
};

let and = (out) => {
	bin1.forEach((x, i) => {
		let stf = trigger_function(() => x.set(1));
		let ttf = trigger_function(() => {
			x.if_is(EQUAL_TO, 1, stf);
		});
		let ftf = trigger_function(() => {
			x.set(0);
		});
		compare(x, EQ, bin2[i], ttf, ftf);
	});
	bin_to_num(out.item);
};

let opcode = counter();
let funct3 = counter();
let funct7 = counter();
let rd = counter();
let rs1 = counter();
opcode.display(145, 145);
funct3.display(190, 145);
funct7.display(235, 145);
rd.display(280, 145);
rs1.display(325, 145);

let real_num = 96469103;
let it = counter(real_num - (2 ** 31 - 1));
let arg = counter(0x7f);
wait(0.1);
// extract opcode
signed_to_bin1(it.item);
num_to_bin2(arg.item);
and(opcode);
reset_bin1.call();
reset_bin2.call();
wait(0.1);
// extract funct3
/*
signed_to_bin1(it.item);
arg.set(0x7);
num_to_bin2(arg.item);
right_shift(12);
and(funct3);
*/

$.liveEditor({ info: true });
