import { Transform, type TransformCallback } from 'node:stream';

const AAC_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

/** Repair the native WCMS media_service FLV envelope, without transcoding payloads.
 * Observed on the installed version: AVC config tagged as audio, absent AAC config,
 * and every raw AAC packet timestamp equal to zero. Browsers cannot demux that.
 */
export class CeibaLiveFlv extends Transform {
  private pending = Buffer.alloc(0);
  private header = false;
  private audioConfig = false;
  private frameMs = 128; // Native CMS AAC-LC, 8000 Hz, 1024 samples/frame.
  private nextAudio = 0;
  private videoTime = 0;
  private sawVideo = false;
  readonly repairs = { tagTypes: 0, audioConfig: 0, audioTimestamps: 0 };

  private tag(type: number, timestamp: number, payload: Buffer) {
    const tag = Buffer.alloc(15 + payload.length);
    const ts = Math.max(0, Math.round(timestamp)) >>> 0;
    tag[0] = type;
    tag.writeUIntBE(payload.length, 1, 3);
    tag.writeUIntBE(ts & 0xffffff, 4, 3);
    tag[7] = ts >>> 24;
    payload.copy(tag, 11);
    tag.writeUInt32BE(11 + payload.length, 11 + payload.length);
    this.push(tag);
  }

  _transform(chunk: Buffer, _encoding: BufferEncoding, done: TransformCallback) {
    try {
      this.pending = Buffer.concat([this.pending, chunk]);
      if (!this.header) {
        if (this.pending.length < 9) return done();
        if (this.pending.subarray(0, 3).toString() !== 'FLV') throw new Error('El CMS no devolvió un contenedor FLV');
        const length = this.pending.readUInt32BE(5) + 4;
        if (length < 13 || length > 4096) throw new Error('Cabecera FLV inválida');
        if (this.pending.length < length) return done();
        this.push(this.pending.subarray(0, length));
        this.pending = this.pending.subarray(length);
        this.header = true;
      }
      let offset = 0;
      while (this.pending.length - offset >= 15) {
        let type = this.pending[offset];
        const size = this.pending.readUIntBE(offset + 1, 3);
        if (size > 8 * 1024 * 1024 || ![8, 9, 18].includes(type)) throw new Error('Paquete FLV inválido del CMS');
        if (this.pending.length - offset < size + 15) break;
        const payload = this.pending.subarray(offset + 11, offset + 11 + size);
        let timestamp = this.pending.readUIntBE(offset + 4, 3) + this.pending[offset + 7] * 0x1000000;
        if (this.pending.readUInt32BE(offset + 11 + size) !== size + 11) throw new Error('Longitud FLV inconsistente');
        // Strict signature: AVCDecoderConfigurationRecord, not an arbitrary codec 1 packet.
        if (type === 8 && payload.length >= 12 && payload[0] === 0x17 && payload[1] === 0 && payload[5] === 1) {
          type = 9;
          this.repairs.tagTypes++;
        }
        if (type === 9 && payload[1] === 1) {
          this.videoTime = timestamp;
          this.sawVideo = true;
        }
        if (type === 8 && payload.length >= 4 && (payload[0] >> 4) === 10) {
          if (payload[1] === 0) {
            const rateIndex = ((payload[2] & 7) << 1) | (payload[3] >> 7);
            const rate = AAC_RATES[rateIndex];
            if (rate) this.frameMs = 1024 * 1000 / rate;
            this.audioConfig = true;
          } else if (payload[1] === 1) {
            if (!this.audioConfig) {
              // Config established from the installed CMS's decoded native live AAC.
              this.tag(8, 0, Buffer.from([0xaf, 0, 0x15, 0x88]));
              this.audioConfig = true;
              this.repairs.audioConfig++;
            }
            if (timestamp === 0) {
              // Advance by AAC sample duration; re-anchor after cellular packet loss.
              if (this.sawVideo && Math.abs(this.nextAudio - this.videoTime) > 1500) {
                this.nextAudio = Math.max(this.nextAudio, this.videoTime);
              }
              timestamp = this.nextAudio;
              this.repairs.audioTimestamps++;
            }
            this.nextAudio = timestamp + this.frameMs;
          }
        }
        this.tag(type, timestamp, payload);
        offset += 15 + size;
      }
      // Copy only the incomplete tag, so a small remainder cannot retain a huge chunk.
      this.pending = Buffer.from(this.pending.subarray(offset));
      done();
    } catch (error) { done(error as Error); }
  }
}
