import numpy as np, wave, sys
SR=44100; DUR=float(sys.argv[1]); N=int(SR*DUR); out=np.zeros((N,2))
nt=lambda m:440*2**((m-69)/12)
rng=np.random.default_rng(3)
def pluck(f,dur,amp):
    n=int(SR*dur); P=int(SR/f); buf=rng.uniform(-1,1,P); y=np.zeros(n)
    for i in range(n):
        y[i]=buf[i%P]; buf[i%P]=0.5*(buf[i%P]+buf[(i+1)%P])*0.996
    return y*amp
# chords: G - Em - C - D (warm folk), 4.2s each
ch=[[43,55,59,62,67],[40,52,55,59,64],[36,48,55,60,64],[38,50,54,57,62]]
pat=[0,2,3,4,3,2,1,3]
step=60/88/2
t=0.2;k=0
cache={}
while t<DUR-1.5:
    c=ch[min(int(t/4.2),3)]; m=c[pat[k%8]]
    if m not in cache: cache[m]=pluck(nt(m),2.2,0.22 if pat[k%8] else 0.3)
    y=cache[m]; s=int(t*SR); e=min(N,s+len(y)); pan=0.35+0.3*(k%3)/2
    out[s:e,0]+=y[:e-s]*(1-pan); out[s:e,1]+=y[:e-s]*pan
    t+=step;k+=1
# soft pad
tt=np.arange(N)/SR
for i,c in enumerate(ch):
    s=int(i*4.2*SR); n=min(N-s,int(5.2*SR))
    if n<=0: continue
    x=np.arange(n)/SR; e=np.minimum(1,x/1.2)*np.minimum(1,(n/SR-x)/1.2)
    for m in c[1:4]:
        w=np.sin(2*np.pi*nt(m)*x)*0.03*e; out[s:s+n,:]+=w[:,None]
# final chord ring
s=int((DUR-1.6)*SR); n=N-s; x=np.arange(n)/SR
for m in (55,59,62,67): out[s:,:]+=(pluck(nt(m),n/SR,0.2))[:,None]
for d,g in ((0.07,0.3),(0.13,0.22),(0.21,0.15)):
    D=int(d*SR); out[D:,0]+=out[:-D,1]*g; out[D:,1]+=out[:-D,0]*g
f=np.ones(N); F=int(1.2*SR); f[-F:]=np.linspace(1,0,F); f[:int(.2*SR)]=np.linspace(0,1,int(.2*SR))
out*=f[:,None]; out/=np.abs(out).max()/0.85
w=wave.open('music.wav','wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out*32767).astype(np.int16).tobytes()); w.close(); print('ok')
