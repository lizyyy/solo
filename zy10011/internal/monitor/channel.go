package monitor

import (
	"time"

	"github.com/deadlock-detector/internal/model"
)

type monitoredChannel struct {
	id     string
	inner  chan interface{}
	info   *model.ChannelInfo
	closed bool
}

func newMonitoredChannel(name string, capacity int, chType model.ChannelType) *monitoredChannel {
	info := &model.ChannelInfo{
		ID:        generateChannelID(),
		Name:      name,
		Type:      chType,
		State:     model.ChannelStateActive,
		Capacity:  capacity,
		CreatedAt: time.Now(),
		LastOpAt:  time.Now(),
	}

	return &monitoredChannel{
		id:    info.ID,
		inner: make(chan interface{}, capacity),
		info:  info,
	}
}

func (c *monitoredChannel) ID() string {
	return c.id
}

func (c *monitoredChannel) Inner() chan interface{} {
	return c.inner
}

func (c *monitoredChannel) Info() *model.ChannelInfo {
	return c.info
}

func (c *monitoredChannel) Send(val interface{}) {
	if c.info.Type == model.ChannelTypeRecvOnly {
		return
	}

	c.inner <- val
	c.info.RecordSend()
}

func (c *monitoredChannel) Recv() (interface{}, bool) {
	if c.info.Type == model.ChannelTypeSendOnly {
		return nil, false
	}

	val, ok := <-c.inner
	if ok {
		c.info.RecordRecv()
	}
	return val, ok
}

func (c *monitoredChannel) Close() {
	if c.closed {
		return
	}
	close(c.inner)
	c.closed = true
	c.info.Close()
}

func generateChannelID() string {
	return "ch-" + time.Now().Format("20060102150405")
}
