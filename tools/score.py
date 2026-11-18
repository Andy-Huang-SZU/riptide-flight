"""Synthesize the instrumental for the public edition from its cue times."""
import json
import math
from pathlib import Path
import subprocess
import wave

import numpy as np
from scipy.signal import butter, sosfilt


ROOT = Path(__file__).resolve().parents[1]
GRID = json.loads((ROOT / "beat-grid.json").read_text())
RATE = 48_000
DURATION = GRID["duration"]
BEATS = [item["time_s"] for item in GRID["beats"]]
CUES = GRID["cues"]
GEN = np.random.default_rng(14774)
OUT = np.zeros((round(DURATION * RATE), 2), dtype=np.float64)
PI2 = 2 * math.pi


def timeline(seconds):
    return np.arange(round(seconds * RATE)) / RATE


def filter_noise(t, cutoff, kind):
    white = GEN.standard_normal(len(t))
    return sosfilt(butter(2, cutoff, kind, fs=RATE, output="sos"), white)


def midi(note):
    return 440 * 2 ** ((note - 69) / 12)


def fade(t, attack=.004, release=.06):
    return np.minimum(1, t / attack) * np.minimum(1, (t[-1] - t) / release)


def add(at, tone, level, pan=0, bus=OUT):
    start = round(at * RATE)
    start_sample = max(0, start)
    cut = max(0, -start)
    length = min(len(tone) - cut, len(bus) - start_sample)
    if length <= 0:
        return
    gains = np.sqrt(np.array([1 - pan, 1 + pan]) / 2)
    bus[start_sample:start_sample+length] += tone[cut:cut+length, None] * gains * level


def kick(pressure=1):
    t = timeline(.255)
    frequency = 47*t + 2.15*(1-np.exp(-46*t)) + 1.0*(1-np.exp(-174*t))
    thud = np.sin(PI2*frequency) * np.exp(-t * (15 - 2 * pressure))
    click = filter_noise(t, [1950, 5800], "bandpass") * np.exp(-t * 298)
    return np.tanh(1.55*thud + .48*click) * fade(t,.0014,.031)


def snare(thickness=1):
    t = timeline(.275)
    noise = filter_noise(t,[800,10_000],"bandpass")
    cloud = np.exp(-t*27)+.30*np.exp(-abs(t-.009)*140)+.15*np.exp(-abs(t-.019)*136)
    shell = (np.sin(PI2*(166*t + .28*(1-np.exp(-72*t)))) + .25*np.sin(PI2*361*t))
    return np.tanh(.95*noise*cloud + .53*shell*np.exp(-t*(32-9*thickness))) * fade(t,.0017,.05)


def hat(long=False):
    t=timeline(.173 if long else .067)
    high=filter_noise(t,[5300,13900],"bandpass")
    metal=sum(np.sign(np.sin(PI2*n*t)) for n in [3141, 4553, 5192, 6527, 7370]) * .067
    return np.tanh(.85*high+metal)*np.exp(-t*(24 if long else 69))*fade(t,.001,.015)


def bass(note, length, open_filter):
    t=timeline(length)
    hz=midi(note)
    phase=PI2*(hz*t + .005*hz*(1-np.exp(-39*t)))
    sub=np.sin(phase)
    harmonics=(.44*np.sin(2*phase+.08)+.27*np.sin(3*phase)+.14*np.sin(5*phase))*np.exp(-t*6)
    if open_filter:
        harmonics += .19*np.sin(6*phase+.41)*np.exp(-t*12)
    return np.tanh(sub*.92+harmonics)*fade(t,.011,.055)


def chord(notes, length, shape):
    t=timeline(length)
    voice=np.zeros_like(t)
    for i,note in enumerate(notes):
        hz=midi(note)
        phase=PI2*(hz*t+.00038*hz*np.sin(PI2*4.6*t))+i*.24
        if shape=="brass":
            mod=(.52+.96*np.exp(-t*3.8))*np.sin(phase*2)
            tone=np.sin(phase+mod)*.77+np.sin(phase*3)*.21*np.exp(-t*14)
        elif shape=="keys":
            tone=np.sin(phase+.42*np.sin(phase*2.01)*np.exp(-t*8))+.21*np.sin(phase*4.05)*np.exp(-t*17)
        else:
            tone=np.sin(phase)*.65+np.sin(phase*.997+.6)*.42+np.sin(phase*2)*.18
        voice += tone
    return voice/len(notes)*fade(t,.014 if shape!="pad" else .095,.10)*np.exp(-t*(4 if shape=="keys" else 1.25))


def scratch(seconds=.225, rise=False):
    t=timeline(seconds)
    pitch=330*t+(3.8 if rise else -1.6)*(1-np.exp(-t*21))
    noise=filter_noise(t,[850,10400],"bandpass")
    window=np.sin(np.pi*np.clip(t/seconds,0,1))**(1.6 if rise else .67)
    return np.tanh(.68*noise+ .21*np.sin(PI2*pitch))*window*fade(t,.001,.035)


def accent(label, at):
    if label=="release":
        add(at,scratch(.23),.28,-.15)
        add(at,snare(.6),.22)
    elif label=="print":
        add(at,kick(),.39)
        add(at,scratch(.16),.28,.36)
        add(at,chord([58,65,68,72],.34,"brass"),.37,-.1)
    elif label=="break":
        add(at,scratch(.40,True),.24)
    elif label=="oil":
        add(at,kick(1.4),.44)
        add(at,snare(),.23)
        add(at,chord([53,60,65,68,72],.75,"brass"),.46,.10)
    elif label=="sun":
        add(at,kick(1.2),.37)
        add(at,chord([53,60,65,68,72,77],1.24,"pad"),.63)
        add(at,hat(True),.22,.5)
    elif label=="end":
        add(at,chord([65,68,72,77],.26,"keys"),.27,.25)


roots=[41,41,37,39,41,44,37,39,41]
for i,at in enumerate(BEATS):
    pos=i%4
    bar=i//4
    delta=BEATS[min(i+1,len(BEATS)-1)]-at
    if delta<=0: delta=.472
    late=at>=CUES["sun"]
    cut=CUES["break"]-.19 < at < CUES["oil"]
    if cut or late: continue
    if i not in (12,28):
        if pos in (0,2):
            add(at,kick(),.48 if pos==0 else .37)
        elif pos in (1,3):
            add(at,snare(),.39 if pos==1 else .44)
    if pos==0 and bar%2:
        add(at+.74*delta,kick(.72),.28)
    if pos==2:
        add(at+.61*delta,kick(.81),.26)
    if pos==0 and bar>0:
        add(at-.29*delta,snare(.25),.065,-.18)
    for subdivision, level, pan in ((0,.125,-.29),(.52,.10,.35),(.77,.048,-.44)):
        add(at+subdivision*delta,hat(subdivision==.52 and pos==3),level,pan)
    if at<CUES["release"]: continue
    root=roots[bar%len(roots)]
    notes=[root, root+12, root+7, root+(3 if bar%2 else 10)]
    for n,(offset, length) in enumerate([(.0,.61),(.73,.21)] if pos in (0,2) else [(.34,.45)]):
        note=notes[(pos+n+(bar%2 if pos==3 else 0))%4]
        add(at+offset*delta,bass(note,length*delta,at>=CUES["oil"]),.23 if pos in (0,2) else .205)
    if bar<3 and pos in (1,3):
        add(at+.51*delta,chord([root+24,root+31,root+34],.30,"brass"),.29,-.23)
    elif 3<=bar<7 and pos in (0,2):
        voices=[root+20,root+27,root+31,root+34]
        add(at+.25*delta,chord(voices,.29,"keys"),.33,.33)
        add(at+.72*delta,chord(voices[1:],.12,"keys"),.16,-.32)
    elif bar>=7:
        if pos in (0,2):
            add(at,chord([root+19,root+24,root+27,root+31],.68,"pad"),.32,.19)
        if pos in (1,3):
            add(at+.49*delta,chord([72,77,80] if bar%2 else [70,75,77],.40,"brass"),.31,-.23)
    if i in [6,10,14,19,23,31,35]:
        add(at+.74*delta,scratch(.10),.115,(-1)**i*.58)

for label,at in CUES.items():
    accent(label,at)

# A short stereo reflection preserves the dry transient that drives the frame cue.
dry=OUT.copy()
for delay, level in ((.026,.082),(.051,.055),(.097,.030)):
    samples=round(delay*RATE)
    OUT[samples:]+=dry[:-samples,::-1]*level

t=np.arange(len(OUT))/RATE
OUT *= np.clip(t/.003,0,1)[:,None] * np.clip((DURATION-t)/.24,0,1)[:,None]
OUT=np.tanh(OUT*1.28)
OUT *= .84/max(.001,np.max(np.abs(OUT)))
raw=ROOT/"assets"/"score.wav"
with wave.open(str(raw),"wb") as stream:
    stream.setparams((2,2,RATE,0,"NONE","not compressed"))
    stream.writeframes(np.round(OUT*32767).astype("<i2").tobytes())
subprocess.run(["ffmpeg","-v","error","-y","-i",str(raw),
    "-c:a","libmp3lame","-b:a","192k",str(ROOT/"assets"/"score.mp3")],check=True)
print(f"Rendered {len(OUT)} samples at {RATE} Hz, {DURATION:.3f} s")
