import { compressRaw, decompressRaw, ENCODE_FINISH } from "../xz";

import "should";
import "source-map-support/register";

describe("Engine", () => {
  it("can be closed exactly once", () => {
    const engine = compressRaw(6);
    engine.close();
    (() => engine.close()).should.throw(/closed/);
  });

  it("encodes in steps", (done) => {
    const writer = compressRaw(6);
    const b1 = Buffer.alloc(128);
    writer.process(Buffer.from("hello, hello!"), b1, 0, (error, used) => {
      (error === undefined).should.eql(true);
      (used || 0).should.eql(24);

      const b2 = Buffer.alloc(128);
      writer.process(undefined, b2, ENCODE_FINISH, (error, used) => {
        (error === undefined).should.eql(true);
        (used || 0).should.eql(40);
        done();
      });
    });
  });

  it("encodes all at once", (done) => {
    const writer = compressRaw(6);
    const b1 = Buffer.alloc(128);
    writer.process(Buffer.from("hello, hello!"), b1, ENCODE_FINISH, (error, used) => {
      (error === undefined).should.eql(true);
      (used || 0).should.eql(64);
      done();
    });
  });

  it("copes with insufficient space", (done) => {
    const writer = compressRaw(6);
    const b1 = Buffer.alloc(32);
    writer.process(Buffer.from("hello, hello!"), b1, ENCODE_FINISH, (error, used) => {
      (error === undefined).should.eql(true);
      (used || 0).should.eql(-32);

      const b2 = Buffer.alloc(32);
      writer.process(undefined, b2, ENCODE_FINISH, (error, used) => {
        (error === undefined).should.eql(true);
        (used || 0).should.eql(32);

        const fullWriter = compressRaw(6);
        const bf = Buffer.alloc(64);
        fullWriter.process(Buffer.from("hello, hello!"), bf, ENCODE_FINISH, (error, used) => {
          (error === undefined).should.eql(true);
          (used || 0).should.eql(64);
          Buffer.concat([ b1, b2 ]).should.eql(bf);
          done();
        });
      });
    });
  });

  it("can decode what it encodes", (done) => {
    const writer = compressRaw(6);
    const b1 = Buffer.alloc(128);
    writer.process(Buffer.from("hello, hello!"), b1, ENCODE_FINISH, (error, used) => {
      (error === undefined).should.eql(true);

      const reader = decompressRaw();
      let b2 = Buffer.alloc(128);
      reader.process(b1.slice(0, used), b2, 0, (error, used) => {
        b2.slice(0, used).toString().should.eql("hello, hello!");
        writer.close();
        done();
      });
    });
  });

  it("encodes into an offset", (done) => {
    const buffer = Buffer.alloc(64);
    Buffer.from("hello").copy(buffer);

    const writer = compressRaw(6);
    writer.process(buffer.slice(0, 5), buffer.slice(8, 64), ENCODE_FINISH, (error, used) => {
      (error === undefined).should.eql(true);
      (used || 0).should.eql(56);

      buffer[0] = 0;
      buffer[2] = 9;

      const reader = decompressRaw();
      reader.process(buffer.slice(8, 64), buffer.slice(0, 8), 0, (error, used) => {
        (error === undefined).should.eql(true);
        (used || 0).should.eql(5);

        buffer.slice(0, 5).toString().should.eql("hello");
        done();
      });
    });
  });

  it("can't close twice", () => {
    const writer = compressRaw(6);
    writer.close();
    (() => writer.close()).should.throw(/already been closed/);
  });

  it("can't be used twice in parallel", () => {
    const inBuffer = Buffer.alloc(65536);
    const outBuffer = Buffer.alloc(65536);
    const writer = compressRaw(6);
    writer.process(inBuffer, outBuffer, ENCODE_FINISH, (error, used) => {
      // don't care.
    });
    (() => writer.process(inBuffer, outBuffer, ENCODE_FINISH, (error, used) => {
      // don't care.
    })).should.throw(/is in use/);
  });
});
