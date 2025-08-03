// NOTICE: this uses features NOT CURRENTLY AVAILABLE in the main G.js library. It is not possible to run this without making modifications.
import '@g-js-api/g.js';
import Binary from './index.js'
import fs from 'fs';

await $.exportConfig({
    type: 'live_editor',
    options: { info: true, verticalPositioning: false }
});

// FIRST COURSE OF ACTION: init character stuff
// load IBM 8x16 VGA font
let fontFile = fs.readFileSync('iv8x16u.bdf').toString();

let currFont = {};
let fonts = [];
let isBitmap = false;
let bitInd = 0;

let shiftBitmapY = (bitmapRows, yOffset) => {
    if (yOffset === 0) return bitmapRows.slice(0, 16);

    let newBitmap = bitmapRows.slice();

    if (yOffset < 0) {
        const padTop = Array(Math.min(-yOffset, 16)).fill(Array(8).fill(0));
        newBitmap = padTop.concat(newBitmap);
    } else {
        const padBottom = Array(Math.min(yOffset, 16)).fill(Array(8).fill(0));
        newBitmap = newBitmap.concat(padBottom);
    }
    return newBitmap.slice(0, 16);
}

let padStartArray = (arr, targetLength, padValue = 0) => {
    const paddingNeeded = Math.max(0, targetLength - arr.length);
    return Array(paddingNeeded).fill(padValue).concat(arr);
}

fontFile.split('\n').forEach(x => {
    x = x.trim();
    if (x.startsWith('ENCODING')) {
        let spaced = x.split(' ');
        currFont.charCode = parseInt(spaced[spaced.length - 1]);
    }
    if (x.startsWith('BITMAP')) {
        isBitmap = true;
        currFont.bitmap = Array(16).fill(Array(8).fill(0));
    }
    if (x.startsWith('BBX')) {
        let [_, w, h, xoff, yoff] = x.split(' ').map(Number);
        currFont.bbx = { width: w, height: h, xoff, yoff };
        currFont.bbx.yoff += 16 - h;
    }
    if (x.startsWith('ENDCHAR')) {
        currFont.bitmap = shiftBitmapY(currFont.bitmap, currFont.bbx.yoff)
        fonts.push(currFont);
        currFont = {};
        isBitmap = false;
        bitInd = 0;
    }
    if (isBitmap && x !== 'BITMAP') {
        let val = parseInt(x, 16);
        if (currFont.bbx.xoff > 0) val = (val >> currFont.bbx.xoff) & 0xFF;
        if (currFont.bbx.xoff < 0) val = (val << -currFont.bbx.xoff) & 0xFF;
        currFont.bitmap[bitInd++ + currFont.bbx.yoff] = padStartArray(val.toString(2).split('').map(x => parseInt(x)), 8);
    }
});

// level stuff
let binary = new Binary(31);

let rdTriggerGroup = unknown_g();
let rdTriggerCenter = unknown_g();
let rs1TriggerGroup = unknown_g();
let rs1TriggerCenter = unknown_g();
let rs2TriggerGroup = unknown_g();
let rs2TriggerCenter = unknown_g();
let sbTriggerGroup = unknown_g();
let sbTriggerCenter = unknown_g();
let lbTriggerGroup = unknown_g();
let lbTriggerCenter = unknown_g();
let igroup = unknown_g();
let icenter = unknown_g();
let resetPoint = unknown_g();
rdTriggerGroup.lock_to_player();
rs1TriggerGroup.lock_to_player();
rs2TriggerGroup.lock_to_player();
sbTriggerGroup.lock_to_player();
lbTriggerGroup.lock_to_player();
igroup.lock_to_player();
resetPoint.lock_to_player();

object({
    OBJ_ID: 3807,
    GROUPS: resetPoint,
    HIDE: true
}).add();

function clearMSB(n) {
    if (n === 0) return 0;
    const msb = 1 << Math.floor(Math.log2(n));
    return n ^ msb; // XOR with the MSB bitmask to clear it
}

let format = (instr) => {
    if (instr > 2 ** 31 - 1) {
        instr = -clearMSB(instr);
    };
    return instr;
};

// 0b000000001100_01010_010_01010_0010011 (slti x10,x10,48)
// 0b000000001100_01010_100_01010_0010011 (xori x10,x10,12)
// 4282713363 (addi x10,x10,-12)

// represents as a signed 32-bit int

let instruction = counter();
let pc = counter();
let uart = counter();
let registers = Array(32).fill().map(_ => counter());
let memSize = 9000; // 9000 * 4 = 36 KB of mem
let memory = Array(memSize).fill().map(x => counter());

// "Hello, World!!!"
memory[4096].set(825514779);
memory[4097].set(1818577005);
memory[4098].set(539783020);
memory[4099].set(1819438935);
memory[4100].set(555819364);

// stack range: 0x00008CA0 - 0x000084A0
registers[2].set((memSize - 1) * 4);

let onUARTWrite = trigger_function(() => { });
let resetExtension;

let execute = trigger_function(() => {
    let signBit = counter();
    compare(instruction, LESS, 0, trigger_function(() => {
        signBit.set(1);
        instruction.abs();
    }), trigger_function(() => {
        signBit.set(0);
    }));

    let befCtx = $.trigger_fn_context();

    // extracting fields
    const shift1 = counter();
    const shift2 = counter();
    const shift3 = counter();
    const shift4 = counter();
    const shift5 = counter();

    item_edit(instruction.item, undefined, shift1.item, ITEM, NONE, ITEM, EQ, DIV, DIV, 2 ** 7, undefined, NONE, FLR).add();
    item_edit(shift1.item, undefined, shift2.item, ITEM, NONE, ITEM, EQ, DIV, DIV, 2 ** 5, undefined, NONE, FLR).add();
    item_edit(shift2.item, undefined, shift3.item, ITEM, NONE, ITEM, EQ, DIV, DIV, 2 ** 3, undefined, NONE, FLR).add();
    item_edit(shift3.item, undefined, shift4.item, ITEM, NONE, ITEM, EQ, DIV, DIV, 2 ** 5, undefined, NONE, FLR).add();
    item_edit(shift4.item, undefined, shift5.item, ITEM, NONE, ITEM, EQ, DIV, DIV, 2 ** 5, undefined, NONE, FLR).add();

    const opcode = binary.bitwise(instruction, AND, 0x7F); // bits 0–6
    let rd = counter(),
        funct3 = counter(),
        funct7 = counter(),
        rs1 = counter(),
        rs2 = counter(),
        imm = counter(),
        imm_signed = counter();

    let lastWriteAddr = counter();
    let lastWriteVal = counter();
    let lastReadAddr = counter();
    let lastReadVal = counter();
    // 120 X, 60 Y
    lastWriteAddr.display(180, 83.5);
    lastWriteVal.display(180, 52.5);
    lastReadAddr.display(480, 83.5);
    lastReadVal.display(480, 52.5);

    let newCtx = $.trigger_fn_context();
    Context.set(befCtx);
    opcode.set(0);
    rd.set(0);
    funct3.set(0);
    funct7.set(0);
    rs1.set(0);
    rs2.set(0);
    imm.set(0);
    imm_signed.set(0);
    Context.set(newCtx);

    let unsigned = counter();
    let contextAfter = trigger_function(() => { });

    let I_type = trigger_function(() => {
        rd.set(binary.bitwise(shift1, AND, 0x1F, false)); // bits 7–11
        funct3.set(binary.bitwise(shift2, AND, 0x07, false)); // bits 12–14
        rs1.set(binary.bitwise(shift3, AND, 0x1F, false)); // bits 15–19
        item_edit(instruction.item, undefined, imm.item, ITEM, NONE, ITEM, EQ, DIV, DIV, 2 ** 20, undefined, NONE, FLR).add(); // bits 20–31

        // converts imm to a signed int
        let tempSign = counter();
        tempSign.set(2048);
        compare(unsigned, EQ, 0, trigger_function(() => {
            compare(signBit, EQ, 1, trigger_function(() => {
                item_edit(imm.item, tempSign.item, imm_signed.item, ITEM, ITEM, ITEM, EQ, SUB, undefined, 1, NONE, NEG).add();
            }), trigger_function(() => {
                imm_signed.set(imm);
            }));
        }));
        contextAfter.call();
    });

    let R_type = trigger_function(() => {
        rd.set(binary.bitwise(shift1, AND, 0x1F, false));
        funct3.set(binary.bitwise(shift2, AND, 0x07, false));
        rs1.set(binary.bitwise(shift3, AND, 0x1F, false));
        rs2.set(binary.bitwise(shift4, AND, 0x1F, false));
        funct7.set(binary.bitwise(shift5, AND, 0x7f, false));
        contextAfter.call();
    });

    // TODO
    let U_type = trigger_function(() => {
        item_edit(instruction.item, undefined, imm.item, ITEM, NONE, ITEM, EQ, DIV, DIV, 2 ** 12, undefined, NONE, FLR).add();
        rd.set(binary.bitwise(shift1, AND, 31, false));
        contextAfter.call();
    });

    let B_type = trigger_function(() => {
        let imm10_5 = binary.bitwise(shift5, AND, 63);
        imm10_5.multiply(32);

        // item_edit(imm10_1.item, undefined, imm10_1.item, ITEM, NONE, ITEM, EQ, DIV, DIV, 2, undefined, NONE, FLR).add();
        let imm4_1 = counter();
        item_edit(shift1.item, undefined, imm4_1.item, ITEM, NONE, ITEM, EQ, DIV, DIV, 2, undefined, NONE, FLR).add();
        imm4_1.set(binary.bitwise(imm4_1, AND, 15));
        imm4_1.multiply(2);

        let imm11 = counter();
        item_edit(shift1.item, undefined, imm11.item, ITEM, NONE, ITEM, EQ, DIV, DIV, 2, undefined, NONE, FLR).add();
        imm11.set(binary.bitwise(imm11, AND, 1, false));

        compare(signBit, EQ, 1, trigger_function(() => {
            imm.add(2048);
        }));

        compare(imm11, EQ, 1, trigger_function(() => {
            imm.add(1024);
        }));

        imm.add(imm10_5);
        imm.add(imm4_1);

        let tempSign2 = counter();
        tempSign2.set(4096);

        compare(signBit, EQ, 1, trigger_function(() => {
            item_edit(imm.item, tempSign2.item, imm_signed.item, ITEM, ITEM, ITEM, EQ, SUB, undefined, 1, NONE, NEG).add();
        }), trigger_function(() => {
            imm_signed.set(imm);
        }));

        rs1.set(binary.bitwise(shift3, AND, 0x1F, false));
        rs2.set(binary.bitwise(shift4, AND, 0x1F, false));
        funct3.set(binary.bitwise(shift2, AND, 0x07, false));

        contextAfter.call();
    });

    let S_type = trigger_function(() => {
        let imm4_0 = binary.bitwise(shift1, AND, 0x1F);
        let imm11_5 = binary.bitwise(shift5, AND, 0x3F);
        imm11_5.multiply(32);
        imm.add(imm4_0).add(imm11_5);

        let tempSign3 = counter();
        tempSign3.set(2048);

        compare(signBit, EQ, 1, trigger_function(() => {
            item_edit(imm.item, tempSign3.item, imm_signed.item, ITEM, ITEM, ITEM, EQ, SUB, undefined, 1, NONE, NEG).add();
        }));

        rs1.set(binary.bitwise(shift3, AND, 0x1F, false));
        rs2.set(binary.bitwise(shift4, AND, 0x1F, false));
        funct3.set(binary.bitwise(shift2, AND, 0x07, false));

        contextAfter.call();
    });

    let J_type = trigger_function(() => {
        let imm19_12 = binary.bitwise(shift2, AND, 0xFF);
        imm19_12.multiply(4096);

        let imm11 = binary.bitwise(shift4, AND, 1);
        imm11.multiply(2048);

        let imm10_1 = counter().set(shift4);
        item_edit(imm10_1.item, undefined, imm10_1.item, ITEM, NONE, ITEM, EQ, DIV, DIV, 2, undefined, NONE, FLR).add();
        binary.bitwise(imm10_1, AND, 0x3FF);
        imm10_1.multiply(2);

        compare(signBit, EQ, 1, trigger_function(() => {
            imm.add(1048576);
        }));

        imm.add(imm19_12);
        imm.add(imm11);
        imm.add(imm10_1);

        let tempSign3 = counter();
        tempSign3.set(2097152);

        compare(signBit, EQ, 1, trigger_function(() => {
            item_edit(imm.item, tempSign3.item, imm.item, ITEM, ITEM, ITEM, EQ, SUB, undefined, 1, NONE, NEG).add();
        }));

        rd.set(binary.bitwise(shift1, AND, 0x1F, false));

        contextAfter.call();
    });

    compare(opcode, EQ, 0b0010011, I_type)
    compare(opcode, EQ, 0b0000011, I_type)
    compare(opcode, EQ, 0b1110011, I_type)
    compare(opcode, EQ, 0b1100111, I_type)
    compare(opcode, EQ, 0b0110011, R_type)
    compare(opcode, EQ, 0b0110111, U_type)
    compare(opcode, EQ, 0b0010111, U_type)
    compare(opcode, EQ, 0b1100011, B_type)
    compare(opcode, EQ, 0b1101111, J_type)
    compare(opcode, EQ, 0b0100011, S_type)

    // new context starts here
    Context.set(contextAfter);

    let offX = 120;
    let offY = 90;

    opcode.display(45 + offX, 45 + offY);
    rd.display(105 + offX, 45 + offY);
    funct3.display(165 + offX, 45 + offY);
    funct7.display(225 + offX, 45 + offY);
    rs1.display(285 + offX, 45 + offY);
    rs2.display(345 + offX, 45 + offY);
    imm.display(405 + offX, 45 + offY);
    imm_signed.to_obj().with(obj_props.SCALING, 0.5).with(obj_props.X, 555).with(obj_props.Y, 157.5).add();

    // LOGIC STARTS HERE
    let tempRs1 = counter();
    let tempRs2 = counter();
    let tempMem = counter();

    let resetTriggers = trigger_function(() => {
        $.add(trigger({
            OBJ_ID: 901,
            TARGET: rdTriggerGroup,
            USE_TARGET: true,
            TARGET_POS_AXES: 1,
            TARGET_POS: resetPoint,
            TARGET_DIR_CENTER: rdTriggerCenter
        }));
        $.add(trigger({
            OBJ_ID: 901,
            TARGET: rs1TriggerGroup,
            USE_TARGET: true,
            TARGET_POS_AXES: 1,
            TARGET_POS: resetPoint,
            TARGET_DIR_CENTER: rs1TriggerCenter
        }));
        $.add(trigger({
            OBJ_ID: 901,
            TARGET: rs2TriggerGroup,
            USE_TARGET: true,
            TARGET_POS_AXES: 1,
            TARGET_POS: resetPoint,
            TARGET_DIR_CENTER: rs2TriggerCenter
        }));
        $.add(trigger({
            OBJ_ID: 901,
            TARGET: lbTriggerGroup,
            USE_TARGET: true,
            TARGET_POS_AXES: 1,
            TARGET_POS: resetPoint,
            TARGET_DIR_CENTER: lbTriggerCenter
        }));
        $.add(trigger({
            OBJ_ID: 901,
            TARGET: sbTriggerGroup,
            USE_TARGET: true,
            TARGET_POS_AXES: 1,
            TARGET_POS: resetPoint,
            TARGET_DIR_CENTER: sbTriggerCenter
        }));
    });

    resetExtension = resetTriggers;

    compare(opcode, EQ, 0b0010011, trigger_function(() => {
        binary.convert(rd, (val) => {
            rdTriggerGroup.move(-val * 20, 0);
        }, false, 5);
        binary.convert(rs1, (val) => {
            rs1TriggerGroup.move(-val * 20, 0);
        }, false, 5);
        // addi
        compare(funct3, EQ, 0x0, trigger_function(() => {
            rs1TriggerGroup.move(0, 30);
            rs1TriggerGroup.move(0, -30, .025);
            tempRs1.add(imm_signed);
            rdTriggerGroup.move(0, 40);
            rdTriggerGroup.move(0, -40, .025);
            resetTriggers.call();
        }));
        // slli
        compare(funct3, EQ, 0x1, trigger_function(() => {
            rs1TriggerGroup.move(0, 30);
            rs1TriggerGroup.move(0, -30, .025);
            imm.set(binary.bitwise(imm, AND, 0x1F, false));
            tempRs1.set(binary.bitwise(tempRs1, LSHIFT, imm, false));
            rdTriggerGroup.move(0, 40);
            rdTriggerGroup.move(0, -40, .025);
            resetTriggers.call();
        }));
        // slti
        // todo: implement sltiu by creating an edge case where imm is unsigned
        compare(funct3, EQ, 0x2, trigger_function(() => {
            rs1TriggerGroup.move(0, 30);
            rs1TriggerGroup.move(0, -30, .025);
            compare(tempRs1, LESS, imm_signed, trigger_function(() => {
                tempRs1.set(1);
            }), trigger_function(() => {
                tempRs1.set(0);
            }));
            rdTriggerGroup.move(0, 40);
            rdTriggerGroup.move(0, -40, .025);
            resetTriggers.call();
        }));
        // sltiu
        compare(funct3, EQ, 0x3, trigger_function(() => {
            rs1TriggerGroup.move(0, 30);
            rs1TriggerGroup.move(0, -30, .025);
            compare(tempRs1, LESS, imm, trigger_function(() => {
                tempRs1.set(1);
            }), trigger_function(() => {
                tempRs1.set(0);
            }));
            rdTriggerGroup.move(0, 40);
            rdTriggerGroup.move(0, -40, .025);
            resetTriggers.call();
        }));
        // xori
        compare(funct3, EQ, 0x4, trigger_function(() => {
            rs1TriggerGroup.move(0, 30);
            rs1TriggerGroup.move(0, -30, .025);
            tempRs1.set(binary.bitwise(tempRs1, XOR, imm, false));
            rdTriggerGroup.move(0, 40);
            rdTriggerGroup.move(0, -40, .025);
            resetTriggers.call();
        }));
        // srli
        let sr = trigger_function(() => {
            rs1TriggerGroup.move(0, 30);
            rs1TriggerGroup.move(0, -30, .025);
            imm.set(binary.bitwise(imm, AND, 0x1F, false));
            tempRs1.set(binary.bitwise(tempRs1, RSHIFT, imm, false));
            rdTriggerGroup.move(0, 40);
            rdTriggerGroup.move(0, -40, .025);
            resetTriggers.call();
        });
        compare(funct3, EQ, 0x5, sr);

        // todo: mask upper 7 bits of imm and compare to 32, if so then call `sr`
        // compare(binary.bitwise(temp, AND, 2016), EQ, 32, sr)

        // ori
        compare(funct3, EQ, 0x6, trigger_function(() => {
            rs1TriggerGroup.move(0, 30);
            rs1TriggerGroup.move(0, -30, .025);
            tempRs1.set(binary.bitwise(tempRs1, OR, imm, false));
            rdTriggerGroup.move(0, 40);
            rdTriggerGroup.move(0, -40, .025);
            resetTriggers.call();
        }));
        // andi
        compare(funct3, EQ, 0x7, trigger_function(() => {
            rs1TriggerGroup.move(0, 30);
            rs1TriggerGroup.move(0, -30, .025);
            tempRs1.set(binary.bitwise(tempRs1, AND, imm_signed, false));
            rdTriggerGroup.move(0, 40);
            rdTriggerGroup.move(0, -40, .025);
            resetTriggers.call();
        }));

        compare(funct3, EQ, 0x2, trigger_function(() => {
            rs1TriggerGroup.move(0, 30);
            rs1TriggerGroup.move(0, -30, .025);
            compare(tempRs1, LESS, imm, trigger_function(() => {
                tempRs1.set(1);
            }), trigger_function(() => {
                tempRs1.set(0);
            }));
            rdTriggerGroup.move(0, 40);
            rdTriggerGroup.move(0, -40, .025);
            resetTriggers.call();
        }));
        pc.add(4);
    }));

    compare(opcode, EQ, 0b0110011, trigger_function(() => {
        binary.convert(rd, (val) => {
            rdTriggerGroup.move(-val * 20, 0);
        }, false, 5);
        binary.convert(rs1, (val) => {
            rs1TriggerGroup.move(-val * 20, 0);
        }, false, 5);
        binary.convert(rs2, (val) => {
            rs2TriggerGroup.move(-val * 20, 0);
        }, false, 5);
        compare(funct3, EQ, 0, trigger_function(() => {
            compare(funct7, EQ, 0, trigger_function(() => {
                rs1TriggerGroup.move(0, 30);
                rs1TriggerGroup.move(0, -30, .025);
                rs2TriggerGroup.move(0, 50);
                rs2TriggerGroup.move(0, -50, .025);
                tempRs1.add(tempRs2);
                rdTriggerGroup.move(0, 40);
                rdTriggerGroup.move(0, -40, .025);
                resetTriggers.call();
            }))

            compare(funct7, EQ, 48, trigger_function(() => {
                rs1TriggerGroup.move(0, 30);
                rs1TriggerGroup.move(0, -30, .025);
                rs2TriggerGroup.move(0, 50);
                rs2TriggerGroup.move(0, -50, .025);
                tempRs1.subtract(tempRs2);
                rdTriggerGroup.move(0, 40);
                rdTriggerGroup.move(0, -40, .025);
                resetTriggers.call();
            }))
        }));

        compare(funct3, EQ, 0x4, trigger_function(() => {
            rs1TriggerGroup.move(0, 30);
            rs1TriggerGroup.move(0, -30, .025);
            rs2TriggerGroup.move(0, 50);
            rs2TriggerGroup.move(0, -50, .025);
            tempRs1.set(binary.bitwise(tempRs1, XOR, tempRs2, false))
            rdTriggerGroup.move(0, 40);
            rdTriggerGroup.move(0, -40, .025);
            resetTriggers.call();
        }));

        compare(funct3, EQ, 0x6, trigger_function(() => {
            rs1TriggerGroup.move(0, 30);
            rs1TriggerGroup.move(0, -30, .025);
            rs2TriggerGroup.move(0, 50);
            rs2TriggerGroup.move(0, -50, .025);
            tempRs1.set(binary.bitwise(tempRs1, OR, tempRs2, false))
            rdTriggerGroup.move(0, 40);
            rdTriggerGroup.move(0, -40, .025);
            resetTriggers.call();
        }));

        compare(funct3, EQ, 0x7, trigger_function(() => {
            rs1TriggerGroup.move(0, 30);
            rs1TriggerGroup.move(0, -30, .025);
            rs2TriggerGroup.move(0, 50);
            rs2TriggerGroup.move(0, -50, .025);
            tempRs1.set(binary.bitwise(tempRs1, AND, tempRs2, false))
            rdTriggerGroup.move(0, 40);
            rdTriggerGroup.move(0, -40, .025);
            resetTriggers.call();
        }));

        compare(funct3, EQ, 0x1, trigger_function(() => {
            rs1TriggerGroup.move(0, 30);
            rs1TriggerGroup.move(0, -30, .025);
            rs2TriggerGroup.move(0, 50);
            rs2TriggerGroup.move(0, -50, .025);
            tempRs1.set(binary.bitwise(tempRs1, LSHIFT, tempRs2, false))
            rdTriggerGroup.move(0, 40);
            rdTriggerGroup.move(0, -40, .025);
            resetTriggers.call();
        }));

        compare(funct3, EQ, 0x5, trigger_function(() => {
            rs1TriggerGroup.move(0, 30);
            rs1TriggerGroup.move(0, -30, .025);
            rs2TriggerGroup.move(0, 50);
            rs2TriggerGroup.move(0, -50, .025);
            tempRs1.set(binary.bitwise(tempRs1, RSHIFT, tempRs2, false))
            rdTriggerGroup.move(0, 40);
            rdTriggerGroup.move(0, -40, .025);
            resetTriggers.call();
        }));

        compare(funct3, EQ, 0x2, trigger_function(() => {
            rs1TriggerGroup.move(0, 30);
            rs1TriggerGroup.move(0, -30, .025);
            rs2TriggerGroup.move(0, 50);
            rs2TriggerGroup.move(0, -50, .025);
            compare(tempRs1, LESS, tempRs2, trigger_function(() => {
                tempRs1.set(1);
            }), trigger_function(() => {
                tempRs1.set(0);
            }));
            rdTriggerGroup.move(0, 40);
            rdTriggerGroup.move(0, -40, .025);
            resetTriggers.call();
        }));

        pc.add(4);
    }));

    compare(opcode, EQ, 0b0110111, trigger_function(() => {
        binary.convert(rd, (val) => {
            rdTriggerGroup.move(-val * 20, 0);
        }, false, 5);
        item_edit(imm.item, undefined, tempRs1.item, ITEM, NONE, ITEM, EQ, MUL, MUL, 2 ** 12).add();
        rdTriggerGroup.move(0, 40);
        rdTriggerGroup.move(0, -40, .025);
        resetTriggers.call();
        pc.add(4);
    }));

    compare(opcode, EQ, 0b0010111, trigger_function(() => {
        binary.convert(rd, (val) => {
            rdTriggerGroup.move(-val * 20, 0);
        }, false, 5);
        item_edit(imm.item, undefined, tempRs1.item, ITEM, NONE, ITEM, EQ, MUL, MUL, 2 ** 12).add();
        tempRs1.add(pc);
        rdTriggerGroup.move(0, 40);
        rdTriggerGroup.move(0, -40, .025);
        resetTriggers.call();

        pc.add(4);
    }));

    compare(opcode, EQ, 0b1100011, trigger_function(() => {
        binary.convert(rd, (val) => {
            rdTriggerGroup.move(-val * 20, 0);
        }, false, 5);
        binary.convert(rs1, (val) => {
            rs1TriggerGroup.move(-val * 20, 0);
        }, false, 5);
        binary.convert(rs2, (val) => {
            rs2TriggerGroup.move(-val * 20, 0);
        }, false, 5);
        compare(funct3, EQ, 0, trigger_function(() => {
            rs1TriggerGroup.move(0, 30);
            rs1TriggerGroup.move(0, -30, .025);
            rs2TriggerGroup.move(0, 50);
            rs2TriggerGroup.move(0, -50, .025);
            compare(tempRs1, EQ, tempRs2, trigger_function(() => {
                pc.add(imm_signed);
            }), trigger_function(() => {
                pc.add(4);
            }));
            resetTriggers.call();
        }));
        compare(funct3, EQ, 0x4, trigger_function(() => {
            rs1TriggerGroup.move(0, 30);
            rs1TriggerGroup.move(0, -30, .025);
            rs2TriggerGroup.move(0, 50);
            rs2TriggerGroup.move(0, -50, .025);
            compare(tempRs1, LESS, tempRs2, trigger_function(() => {
                pc.add(imm_signed);
            }), trigger_function(() => {
                pc.add(4);
            }));
            resetTriggers.call();
        }));
        compare(funct3, EQ, 0x1, trigger_function(() => {
            rs1TriggerGroup.move(0, 30);
            rs1TriggerGroup.move(0, -30, .025);
            rs2TriggerGroup.move(0, 50);
            rs2TriggerGroup.move(0, -50, .025);
            compare(tempRs1, NOT_EQ, tempRs2, trigger_function(() => {
                pc.add(imm_signed);
            }), trigger_function(() => {
                pc.add(4);
            }));
            resetTriggers.call();
        }));
        compare(funct3, EQ, 0x5, trigger_function(() => {
            rs1TriggerGroup.move(0, 30);
            rs1TriggerGroup.move(0, -30, .025);
            rs2TriggerGroup.move(0, 50);
            rs2TriggerGroup.move(0, -50, .025);
            compare(tempRs1, GREATER_OR_EQ, tempRs2, trigger_function(() => {
                pc.add(imm_signed);
            }), trigger_function(() => {
                pc.add(4);
            }));
            resetTriggers.call();
        }));
    }));

    compare(opcode, EQ, 0b1101111, trigger_function(() => {
        binary.convert(rd, (val) => {
            rdTriggerGroup.move(-val * 20, 0);
        }, false, 5);
        tempRs1.add(4).add(pc);
        pc.add(imm);
        rdTriggerGroup.move(0, 40);
        rdTriggerGroup.move(0, -40, .025);
        resetTriggers.call();
    }));

    compare(opcode, EQ, 0b1100111, trigger_function(() => {
        binary.convert(rs1, (val) => {
            rs1TriggerGroup.move(-val * 20, 0);
        }, false, 5);
        binary.convert(rd, (val) => {
            rdTriggerGroup.move(-val * 20, 0);
        }, false, 5);
        tempRs1.add(4).add(pc);
        rdTriggerGroup.move(0, 40);
        rdTriggerGroup.move(0, -40, .025);
        rs1TriggerGroup.move(0, 30);
        rs1TriggerGroup.move(0, -30, .025);
        pc.set(tempRs1).add(imm);
        resetTriggers.call();
    }));

    compare(opcode, EQ, 0b0000011, trigger_function(() => {
        binary.convert(rs1, (val) => {
            rs1TriggerGroup.move(-val * 20, 0);
        }, false, 5);
        binary.convert(rd, (val) => {
            rdTriggerGroup.move(-val * 20, 0);
        }, false, 5);
        // todo: implement lh by copying the logic from lb and extending it to 16 bits
        // lb
        compare(funct3, EQ, 0x0, trigger_function(() => {
            rs1TriggerGroup.move(0, 30);
            rs1TriggerGroup.move(0, -30, .025);
            let wordIndex = counter();
            tempRs1.add(imm);
            // do stuff here
            $.add(item_edit(tempRs1.item, undefined, wordIndex.item, ITEM, ITEM, ITEM, EQ, DIV, DIV, 4, undefined, undefined, undefined, FLR));
            let byteOffset = tempRs1.mod(4).multiply(8);
            tempMem.set(wordIndex);
            binary.convert(tempMem, (val) => {
                lbTriggerGroup.move(-val * 20, 0);
            }, false, 15);
            lbTriggerGroup.move(0, 70);
            lbTriggerGroup.move(0, -70, .025);
            tempMem.set(binary.bitwise(tempMem, RSHIFT, byteOffset, false));
            wait(1 / 240); // for fixing bugs
            tempMem.set(binary.bitwise(tempMem, AND, 0xFF, false));
            tempRs1.set(tempMem);
            // sign bit handling
            compare(tempRs1, GREATER_OR_EQ, 128, trigger_function(() => {
                let sbitTemp = counter(256);
                item_edit(sbitTemp.item, tempRs1.item, tempRs1.item, ITEM, ITEM, ITEM, EQ, SUB, undefined, 1, NONE, NEG).add();
            }));
            rdTriggerGroup.move(0, 40);
            rdTriggerGroup.move(0, -40, .025);
            resetTriggers.call();
        }));
        // lbu
        compare(funct3, EQ, 0x4, trigger_function(() => {
            rs1TriggerGroup.move(0, 30);
            rs1TriggerGroup.move(0, -30, .025);
            let wordIndex = counter();
            tempRs1.add(imm);
            lastReadAddr.set(tempRs1);
            // do stuff here
            $.add(item_edit(undefined, tempRs1.item, wordIndex.item, NONE, ITEM, ITEM, EQ, DIV, DIV, 4, undefined, undefined, undefined, FLR));
            let byteOffset = tempRs1.mod(4).multiply(8);
            tempMem.set(wordIndex);
            binary.convert(tempMem, (val) => {
                lbTriggerGroup.move(-val * 20, 0);
            }, false, 15);
            lbTriggerGroup.move(0, 70);
            lbTriggerGroup.move(0, -70, .035);
            tempMem.set(binary.bitwise(tempMem, RSHIFT, byteOffset, false));
            tempMem.set(binary.bitwise(tempMem, AND, 0xFF, false));
            tempRs1.set(tempMem);
            lastReadVal.set(tempRs1);
            rdTriggerGroup.move(0, 40);
            rdTriggerGroup.move(0, -40, .025);
            resetTriggers.call();
        }));
        // lh
        compare(funct3, EQ, 0x1, trigger_function(() => {
            rs1TriggerGroup.move(0, 30);
            rs1TriggerGroup.move(0, -30, .025);
            let wordIndex = counter();
            tempRs1.add(imm);
            // do stuff here
            $.add(item_edit(undefined, tempRs1.item, wordIndex.item, NONE, ITEM, ITEM, EQ, DIV, DIV, 2, undefined, undefined, undefined, FLR));
            let byteOffset = tempRs1.mod(2).multiply(2);
            tempMem.set(wordIndex);
            binary.convert(tempMem, (val) => {
                lbTriggerGroup.move(-val * 20, 0);
            }, false, 15);
            lbTriggerGroup.move(0, 70);
            lbTriggerGroup.move(0, -70, .025);
            tempMem.set(binary.bitwise(tempMem, RSHIFT, byteOffset, false));
            wait(1 / 240); // for fixing bugs
            tempMem.set(binary.bitwise(tempMem, AND, 0xFFFF, false));
            tempRs1.set(tempMem);
            rdTriggerGroup.move(0, 40);
            rdTriggerGroup.move(0, -40, .025);
            resetTriggers.call();
        }));
        // lw
        compare(funct3, EQ, 0x2, trigger_function(() => {
            rs1TriggerGroup.move(0, 30);
            rs1TriggerGroup.move(0, -30, .025);
            tempRs1.add(imm_signed);
            tempMem.set(tempRs1);
            lastReadAddr.set(tempMem);
            tempMem.divide(4);
            binary.convert(tempMem, (val) => {
                lbTriggerGroup.move(-val * 20, 0);
            }, false, 15);
            lbTriggerGroup.move(0, 70);
            lbTriggerGroup.move(0, -70, .05);
            tempRs1.set(tempMem);
            lastReadVal.set(tempRs1);
            rdTriggerGroup.move(0, 40);
            rdTriggerGroup.move(0, -40, .025);
            resetTriggers.call();
        }));
        pc.add(4);
    }));

    compare(opcode, EQ, 0b0100011, trigger_function(() => {
        binary.convert(rs1, (val) => {
            rs1TriggerGroup.move(-val * 20, 0);
        }, false, 5);
        binary.convert(rs2, (val) => {
            rs2TriggerGroup.move(-val * 20, 0);
        }, false, 5);

        // sw
        compare(funct3, EQ, 0x2, trigger_function(() => {
            rs1TriggerGroup.move(0, 30);
            rs1TriggerGroup.move(0, -30, .025);
            rs2TriggerGroup.move(0, 50);
            rs2TriggerGroup.move(0, -50, .025);
            // tempRs1 stores the address
            // tempRs2 stores the value that needs to be written
            // write rs2 to tempMem
            tempRs1.add(imm_signed);
            lastWriteAddr.set(tempRs1);

            // UART, also impl for sb
            let uartAddress = counter(0x1000);
            uartAddress.multiply(2 ** 16);
            compare(tempRs1, EQ, uartAddress, trigger_function(() => {
                uart.set(tempRs2);
                onUARTWrite.call();
            }), trigger_function(() => {
                tempRs1.divide(4);

                tempMem.set(tempRs2);
                binary.convert(tempRs1, (val) => {
                    sbTriggerGroup.move(-val * 20, 0);
                }, false, 15);
                lastWriteVal.set(tempMem);
                sbTriggerGroup.move(0, 70);
                sbTriggerGroup.move(0, -70, .025);
            }));
            resetTriggers.call();
        }));

        pc.add(4);
    }));

    let scale = 1 / 4;
    registers.forEach((x, i) => {
        let column = i % 10;
        let row = Math.floor(i / 10);
        let offX = 225;
        let offY = 265;
        x.to_obj().with(obj_props.SCALING, scale).with(obj_props.X, offX + ((column * 60) * scale)).with(obj_props.Y, (offY - (row * 30) * scale)).add();
    });

    for (let i = 0; i < 32; i++) {
        object({
            OBJ_ID: 3619,
            GROUPS: [rs2TriggerGroup, i === 0 ? rs2TriggerCenter : undefined].filter(x => x),
            X: (i * 60),
            Y: -135,
            SPAWN_TRIGGERED: false,
            TOUCH_TRIGGERED: true,
            MULTI_TRIGGER: true,
            ITEM_ID_1: registers[i].item,
            ITEM_TARGET: tempRs2.item,
            TYPE_1: ITEM,
            ITEM_TARGET_TYPE: ITEM,
            ASSIGN_OP: EQ,
            MOD: 1
        }).add();
    }

    for (let i = 0; i < 32; i++) {
        object({
            OBJ_ID: 3619,
            GROUPS: [rdTriggerGroup, i === 0 ? rdTriggerCenter : undefined].filter(x => x),
            X: (i * 60),
            Y: -105,
            SPAWN_TRIGGERED: false,
            TOUCH_TRIGGERED: true,
            MULTI_TRIGGER: true,
            ITEM_ID_1: tempRs1.item,
            ITEM_TARGET: registers[i].item,
            TYPE_1: ITEM,
            ITEM_TARGET_TYPE: ITEM,
            ASSIGN_OP: EQ,
            MOD: 1
        }).add()
    }

    for (let i = 0; i < 32; i++) {
        object({
            OBJ_ID: 3619,
            GROUPS: [rs1TriggerGroup, i === 0 ? rs1TriggerCenter : undefined].filter(x => x),
            X: (i * 60),
            Y: -75,
            SPAWN_TRIGGERED: false,
            TOUCH_TRIGGERED: true,
            MULTI_TRIGGER: true,
            ITEM_ID_1: registers[i].item,
            ITEM_TARGET: tempRs1.item,
            TYPE_1: ITEM,
            ITEM_TARGET_TYPE: ITEM,
            ASSIGN_OP: EQ,
            MOD: 1
        }).add();
    }

    for (let i = 0; i < memSize; i++) {
        object({
            OBJ_ID: 3619,
            GROUPS: [sbTriggerGroup, i === 0 ? sbTriggerCenter : undefined].filter(x => x),
            X: (i * 60),
            Y: -165,
            SPAWN_TRIGGERED: false,
            TOUCH_TRIGGERED: true,
            MULTI_TRIGGER: true,
            ITEM_ID_1: tempMem.item,
            ITEM_TARGET: memory[i].item,
            TYPE_1: ITEM,
            ITEM_TARGET_TYPE: ITEM,
            ASSIGN_OP: EQ,
            MOD: 1
        }).add();
    }

    for (let i = 0; i < memSize; i++) {
        object({
            OBJ_ID: 3619,
            GROUPS: [lbTriggerGroup, i === 0 ? lbTriggerCenter : undefined].filter(x => x),
            X: (i * 60),
            Y: -195,
            SPAWN_TRIGGERED: false,
            TOUCH_TRIGGERED: true,
            MULTI_TRIGGER: true,
            ITEM_ID_1: memory[i].item,
            ITEM_TARGET: tempMem.item,
            TYPE_1: ITEM,
            ITEM_TARGET_TYPE: ITEM,
            ASSIGN_OP: EQ,
            MOD: 1
        }).add();
    }

    $.add(trigger({
        OBJ_ID: 901,
        TARGET: igroup,
        USE_TARGET: true,
        TARGET_POS_AXES: 1,
        TARGET_POS: resetPoint,
        TARGET_DIR_CENTER: icenter
    }));
})

let parseBinaryFile = (filePath) => {
    const buffer = fs.readFileSync(filePath);

    if (buffer.length % 4 !== 0) {
        throw new Error('File size is not aligned to 32-bit instructions.');
    }

    const instructions = [];
    for (let i = 0; i < buffer.length; i += 4) {
        const int32 = buffer.readUInt32LE(i);
        instructions.push(int32);
    }

    return instructions;
}

let instructions = parseBinaryFile('dump.bin');

let running = counter(1);

let exec_loop = trigger_function(() => {
    let old = $.trigger_fn_context();
    igroup.move(0, 20);
    igroup.move(0, -20, .025);
    execute.call();
    $.extend_trigger_func(resetExtension, () => {
        binary.convert(pc, (val) => {
            igroup.move(-val * 10, 0);
        }, false, 16);
        compare(pc, LESS, instructions.length * 4, trigger_function(() => {
            compare(running, EQ, 1, trigger_function(() => old.call()));
        }), trigger_function(() => {
            end(true, false, true);
        }));
    });
});

pc.display(345, 75);

// enforce x0 = 0
let tempCount = counter();
let pcInit = counter();
frame_loop(trigger_function(() => {
    compare(tempCount, EQ, registers[0], undefined, trigger_function(() => {
        registers[0].set(0);
    }));
    compare(pc, EQ, 0, trigger_function(() => {
        compare(pcInit, EQ, 1, trigger_function(() => {
            // halt if unexpected PC = 0x0
            running.set(0);
            pcInit.set(0);
            end(true, false, true);
            log.runtime.flash(rgb(255, 0, 0));
        }));
    }), trigger_function(() => {
        pcInit.set(1);
    }));
    tempCount.set(registers[0]);
}));
exec_loop.call();

// back to char printing
let bgParticle = unknown_g();
let bgColor = unknown_c();
let fgColor = unknown_c();

bgColor.set(rgb(0, 0, 0));
fgColor.set(rgb(173, 170, 173));

let particle = unknown_g();
particle_system({
    MAX_PARTICLES: 1,
    DURATION: -1,
    LIFETIME: 9999,
    EMISSION: -1,
    START_SIZE: 30,
    END_SIZE: 30,
    FREE_RELATIVE_GROUPED: 2,
    START_A: 1,
    END_A: 1
}, true).with(obj_props.GROUPS, particle).with(obj_props.COLOR, fgColor).with(obj_props.HIDE, true).add();

let gridGroups = Array(16).fill(Array(8).fill(0)).map(x => x.map(_ => unknown_g()));
let dotGroups = Array(16).fill(Array(8).fill(0)).map(x => x.map(_ => unknown_g()));
let spawnChar = unknown_g();
let cursorGroup = unknown_g();

let charSize = 0.0625 / 3;
let [avgX, avgY] = [0, 0];
let avgTerms = 0;
for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 8; x++) {
        $.add(object({
            OBJ_ID: 3608,
            TARGET: particle,
            TARGET_POS: dotGroups[y][x],
            X: ((x * charSize) * 30),
            Y: ((16 - y) * charSize * 30),
            SCALING: charSize,
            GROUPS: gridGroups[y][x],
            SPAWN_TRIGGERED: true,
            MULTI_TRIGGER: true,
            554: charSize
        }));
        object({
            OBJ_ID: 3802,
            GROUPS: [dotGroups[y][x], spawnChar],
            X: 105 + ((x * charSize) * 30),
            Y: 585 + ((16 - y) * charSize * 30),
            SCALING: charSize,
            HIDE: true
        }).add();
        avgTerms++;
        avgX += 105 + ((x * charSize) * 30);
        avgY += 585 + ((16 - y) * charSize * 30);
    }
};
avgX /= avgTerms; avgY /= avgTerms;

$.add(object({
    OBJ_ID: 211,
    X: avgX + 1,
    Y: avgY,
    SCALE_X: charSize * 8,
    SCALE_Y: charSize * 16,
    COLOR: fgColor,
    GROUPS: cursorGroup
}));

let textReset = counter();

let character = counter();
let ascii = fonts.slice(0, 191);

textReset.display(15, 15)

particle_system({
    MAX_PARTICLES: 1,
    DURATION: -1,
    LIFETIME: 9999,
    EMISSION: -1,
    START_SIZE: 30,
    END_SIZE: 30,
    FREE_RELATIVE_GROUPED: 2,
    START_A: 1,
    END_A: 1
}, true).with(obj_props.GROUPS, bgParticle).with(obj_props.COLOR, bgColor).with(obj_props.HIDE, true).add();

// draws characters & parses ANSI codes (still very much WIP!!!!)
let drawChar = trigger_function(() => {
    // foreground
    gridGroups.forEach(x => {
        x.forEach(pix => {
            pix.remap([particle, bgParticle]).call();
            pix.remap();
        });
    });
    wait(.01);
    // char draw
    ascii.forEach(char => {
        compare(character, EQ, char.charCode, trigger_function(() => {
            char.bitmap.forEach((x, yi) => {
                x.forEach((y, xi) => {
                    if (y) gridGroups[yi][xi].call()
                });
            })

            textReset.add(1);
        }));
    })
    compare(character, EQ, 10, trigger_function(() => {
        binary.convert(textReset, (val) => {
            spawnChar.move(-(val * (8 * charSize * 10)), 0);
            cursorGroup.move(-(val * (8 * charSize * 10)), 0);
        }, true, 8);
        spawnChar.move(-(8 * charSize * 10), -(16 * charSize * 10));
        cursorGroup.move(-(8 * charSize * 10), -(16 * charSize * 10));
        textReset.reset();
    }));
})

let waitForANSI = counter(1);
let isANSI = counter(1);
let noDisplay = counter(1);
let opANSI = counter(0);

waitForANSI.display(45, 45);
isANSI.display(45, 75);
noDisplay.display(45, 105);
opANSI.display(45, 135);

// handles ANSI codes
let handleANSI = trigger_function(() => {
    compare(opANSI, EQ, 41, trigger_function(() => {
        bgColor.set(rgb(128, 0, 0));
    }));
    compare(opANSI, EQ, 101, trigger_function(() => {
        bgColor.set(rgb(255, 85, 85));
    }));
});

// draws text when UART is updated
$.extend_trigger_func(onUARTWrite, () => {
    character.set(uart);
    // ANSI parsing first
    // tries capturing ANSI escape codes
    compare(uart, EQ, 27, trigger_function(() => {
        wait(.01);
        waitForANSI.set(0);
        wait(.01);
        noDisplay.set(0);
    }));
    // if it reaches [
    compare(uart, EQ, 91, trigger_function(() => {
        compare(waitForANSI, EQ, 0, trigger_function(() => {
            wait(.01);
            isANSI.set(0);
            wait(.01);
            noDisplay.set(0);
        }));
    }), trigger_function(() => {
        compare(waitForANSI, EQ, 0, trigger_function(() => {
            wait(.01);
            waitForANSI.set(1);
            wait(.01);
            noDisplay.set(1);
        }));
    }));
    wait(.01);
    compare(isANSI, EQ, 0, trigger_function(() => {
        compare(waitForANSI, EQ, 1, trigger_function(() => {
            // handle numbers, semicolons & exits
            // less than 58 = number
            compare(uart, LESS, 58, trigger_function(() => {
                let digit = counter().set(uart);
                digit.subtract(48); // subtracts ASCII char code of number 0
                wait(.01);
                opANSI.multiply(10).add(digit);
            }))
            // ;
            compare(uart, EQ, 59, trigger_function(() => {
                // handle ANSI code
                handleANSI.call();
                wait(.01);
                opANSI.set(0);
            }));
            // m (exit)
            compare(uart, EQ, 109, trigger_function(() => {
                handleANSI.call();
                wait(.01);
                isANSI.set(1);
                wait(.01);
                opANSI.set(0);
                wait(.01);
                noDisplay.set(1);
            }));
        }), trigger_function(() => {
            wait(.01);
            waitForANSI.set(1);
            console.log($.trigger_fn_context());
        }));
    }));
    wait(.01);
    compare(noDisplay, EQ, 1, trigger_function(() => {
        drawChar.call();
        wait(.01);
        spawnChar.move(8 * charSize * 10, 0);
        cursorGroup.move(8 * charSize * 10, 0);
    }));
});

// cursor blink
trigger_function(() => {
    let old = $.trigger_fn_context();
    cursorGroup.toggle_off();
    wait(0.84); // VGA blink rate
    cursorGroup.toggle_on();
    old.call(0.84);
}).call();

for (let i = 0; i < instructions.length; i++) {
    object({
        OBJ_ID: 1817,
        GROUPS: [igroup, i === 0 ? icenter : undefined].filter(x => x),
        X: (i * 120),
        Y: -45,
        SPAWN_TRIGGERED: false,
        TOUCH_TRIGGERED: true,
        MULTI_TRIGGER: true,
        COUNT: format(instructions[i]),
        ITEM: instruction.item,
        OVERRIDE_COUNT: true
    }).add();
}
