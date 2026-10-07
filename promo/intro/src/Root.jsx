import { Composition } from 'remotion'
import { IntroV1 } from './IntroV1'
import { Showreel } from './Showreel'

export const RemotionRoot = () => (
  <>
    <Composition
      id="OpenLIMSShowreel"
      component={Showreel}
      durationInFrames={900}
      fps={60}
      width={1080}
      height={1920}
    />
    <Composition id="OpenLIMSIntroV1" component={IntroV1} durationInFrames={780} fps={60} width={1080} height={1920} />
  </>
)
