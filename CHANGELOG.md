6.4.0:
- added 'keyframe' event to videoroom

6.3.0:
- added talking events to videoroom plugin

6.2.5:
- dependency upgrade

6.2.4:
- changed deprecated ptype in VideoRoomPublisher from 'listener' to 'subscriber'

6.2.3:
- handling exceptions coming from websocket

6.2.2:
- fix for videoorient_ext

6.2.1:
- update videoroom parameters

6.2.0:
- add VideoCall plugin
- updated dependencies

6.1.0:
- use isomorphic-ws for websocket abstraction
- handle slow_link event in videoroom

6.0.0:
- drop support for node v8
- updated dependencies

5.0.0:
- drop support for node v6

4.0.1:
- fix for cleaning up transactions

4.0.0:
- added more function to SdpHelper
- more error handling to Plugins
- supported only node 6+ on backends
- upgraded dependencies

3.1.0:
- publisher and listener accepts video/audio arguments

3.0.0:
- BC: VideoRoomPublisher events

2.3.0:
- StreamingJanusPlugin added
- fixes to VideoRoomPublisher

2.2.0
- RTP forward added to VideoRoomPublisher

2.1.2
- force detach plugins

2.1.1
- fix JanusAdmin config
- force cleanup after destroy

2.1.0
- improve cleanup
- add optional transaction timeout

2.0.0
- Split VideoRoom Listener/Publisher
- Added VideoRoom Publisher/Listener Test

1.1.2
- npm publish fix

1.1.1
- fix for module export

1.1.0
- browser compatible
- RecordPlayJanusPlugin added
- tests added

1.0.7
- removed MediaOptions from constructors  (no needed for janus 0.3.0) 
