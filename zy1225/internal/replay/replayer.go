package replay

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/zy1225/chanalyzer/internal/models"
	"github.com/zy1225/chanalyzer/internal/storage"
)

type Replayer struct {
	store    *storage.SQLiteStore
	timeline *models.Timeline
}

func NewReplayer(store *storage.SQLiteStore) *Replayer {
	return &Replayer{
		store:    store,
		timeline: models.NewTimeline(),
	}
}

func (r *Replayer) GetTimeline() *models.Timeline {
	return r.timeline
}

func (r *Replayer) LoadEventsFromFile(filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("failed to open events file: %w", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	lineNum := 0

	for scanner.Scan() {
		lineNum++
		line := scanner.Text()

		if line == "" || line[0] == '#' {
			continue
		}

		var event models.Event
		if err := json.Unmarshal([]byte(line), &event); err != nil {
			return fmt.Errorf("line %d: invalid JSON: %w", lineNum, err)
		}

		r.timeline.AddEvent(&event)
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("error reading file: %w", err)
	}

	fmt.Printf("Loaded %d events from %s\n", len(r.timeline.Events), filePath)
	return nil
}

func (r *Replayer) LoadCase(c *models.ChannelCase) error {
	fmt.Printf("Loading case: %s (%s)\n", c.Name, c.ID)

	for _, chDef := range c.Channels {
		var ch *models.Hchan
		if chDef.IsNil {
			ch = models.NewNilHchan(chDef.ID)
		} else {
			ch = models.NewHchan(chDef.ID, chDef.BufferSize, 8)
		}
		r.timeline.AddChannel(ch)

		event := models.NewEvent(models.EventTypeChannelCreate).
			WithChannel(chDef.ID).
			WithMetadata(models.EventMetadata{
				BufferSize: chDef.BufferSize,
				IsBuffered: chDef.BufferSize > 0,
			})
		r.timeline.AddEvent(event)
	}

	for _, gDef := range c.Goroutines {
		g := models.NewGoroutine(gDef.ID, gDef.Name)
		r.timeline.AddGoroutine(g)

		event := models.NewEvent(models.EventTypeGoroutineStart).
			WithGoroutine(gDef.ID)
		r.timeline.AddEvent(event)
	}

	for _, step := range c.Steps {
		r.processStep(step)
	}

	return nil
}

func (r *Replayer) processStep(step models.StepDef) {
	var event *models.Event

	switch step.Action {
	case "send":
		event = r.processSend(step)
	case "recv":
		event = r.processRecv(step)
	case "close":
		event = r.processClose(step)
	case "select":
		event = r.processSelect(step)
	default:
		event = models.NewEvent(models.EventType("unknown"))
	}

	if event != nil {
		if step.Comment != "" {
			event.Metadata.Extra = map[string]interface{}{
				"comment": step.Comment,
			}
		}
		r.timeline.AddEvent(event)
	}
}

func (r *Replayer) processSend(step models.StepDef) *models.Event {
	ch := r.timeline.GetChannel(step.Channel)
	g := r.timeline.GetGoroutine(step.Goroutine)

	if ch == nil {
		return models.NewEvent(models.EventType("error")).
			WithChannel(step.Channel).
			WithGoroutine(step.Goroutine).
			WithMetadata(models.EventMetadata{
				BlockReason: "channel_not_found",
			})
	}

	event := models.NewEvent(models.EventTypeSend).
		WithChannel(step.Channel).
		WithGoroutine(step.Goroutine).
		WithValue(step.Value)

	if ch.State == models.ChannelStateNil {
		event.Metadata.BlockReason = "send_on_nil_channel"
		if g != nil {
			g.Block(step.Channel)
		}
		r.timeline.AddSnapshot(ch.Snapshot())
		return event
	}

	if ch.State == models.ChannelStateClosed {
		event.Metadata.BlockReason = "send_on_closed_channel"
		r.timeline.AddSnapshot(ch.Snapshot())
		return event
	}

	if ch.IsUnbuffered() {
		if ch.HasWaitingReceivers() {
			receiver := ch.DequeueReceiver()
			if receiver != nil {
				receiver.Unblock()
			}
			event.Metadata.Extra = map[string]interface{}{
				"unblocked_receiver": receiver.ID,
			}
		} else {
			if g != nil {
				g.Block(step.Channel)
				ch.EnqueueSender(g)
			}
			event.Metadata.BlockReason = "no_receiver_ready"
		}
	} else {
		if ch.IsBufferFull() {
			if g != nil {
				g.Block(step.Channel)
				ch.EnqueueSender(g)
			}
			event.Metadata.BlockReason = "buffer_full"
		} else {
			ch.PushToBuffer(step.Value)
		}
	}

	r.timeline.AddSnapshot(ch.Snapshot())
	return event
}

func (r *Replayer) processRecv(step models.StepDef) *models.Event {
	ch := r.timeline.GetChannel(step.Channel)
	g := r.timeline.GetGoroutine(step.Goroutine)

	event := models.NewEvent(models.EventTypeRecv).
		WithChannel(step.Channel).
		WithGoroutine(step.Goroutine)

	if ch == nil {
		event.Metadata.BlockReason = "channel_not_found"
		return event
	}

	if ch.State == models.ChannelStateNil {
		event.Metadata.BlockReason = "recv_on_nil_channel"
		if g != nil {
			g.Block(step.Channel)
		}
		r.timeline.AddSnapshot(ch.Snapshot())
		return event
	}

	if ch.State == models.ChannelStateClosed {
		if ch.IsBufferEmpty() {
			event.Metadata.Extra = map[string]interface{}{
				"received_zero": true,
			}
		} else {
			val, _ := ch.PopFromBuffer()
			event.WithValue(val)
		}
		r.timeline.AddSnapshot(ch.Snapshot())
		return event
	}

	if ch.IsUnbuffered() {
		if ch.HasWaitingSenders() {
			sender := ch.DequeueSender()
			if sender != nil {
				sender.Unblock()
			}
			event.Metadata.Extra = map[string]interface{}{
				"unblocked_sender": sender.ID,
			}
		} else {
			if g != nil {
				g.Block(step.Channel)
				ch.EnqueueReceiver(g)
			}
			event.Metadata.BlockReason = "no_sender_ready"
		}
	} else {
		if ch.IsBufferEmpty() {
			if ch.HasWaitingSenders() {
				sender := ch.DequeueSender()
				if sender != nil {
					sender.Unblock()
				}
			} else {
				if g != nil {
					g.Block(step.Channel)
					ch.EnqueueReceiver(g)
				}
				event.Metadata.BlockReason = "buffer_empty"
			}
		} else {
			val, _ := ch.PopFromBuffer()
			event.WithValue(val)
		}
	}

	r.timeline.AddSnapshot(ch.Snapshot())
	return event
}

func (r *Replayer) processClose(step models.StepDef) *models.Event {
	ch := r.timeline.GetChannel(step.Channel)
	g := r.timeline.GetGoroutine(step.Goroutine)

	event := models.NewEvent(models.EventTypeClose).
		WithChannel(step.Channel).
		WithGoroutine(step.Goroutine)

	if ch == nil {
		event.Metadata.BlockReason = "channel_not_found"
		return event
	}

	if ch.State == models.ChannelStateNil {
		event.Metadata.BlockReason = "close_nil_channel"
		r.timeline.AddSnapshot(ch.Snapshot())
		return event
	}

	if ch.State == models.ChannelStateClosed {
		event.Metadata.BlockReason = "close_closed_channel"
		r.timeline.AddSnapshot(ch.Snapshot())
		return event
	}

	gName := ""
	if g != nil {
		gName = g.ID
	}
	ch.Close(gName)

	for ch.HasWaitingSenders() {
		sender := ch.DequeueSender()
		if sender != nil {
			sender.Unblock()
		}
	}

	for ch.HasWaitingReceivers() {
		receiver := ch.DequeueReceiver()
		if receiver != nil {
			receiver.Unblock()
		}
	}

	r.timeline.AddSnapshot(ch.Snapshot())
	return event
}

func (r *Replayer) processSelect(step models.StepDef) *models.Event {
	event := models.NewEvent(models.EventTypeSelect).
		WithGoroutine(step.Goroutine)

	var selectCases []models.SelectCase
	for i, sc := range step.SelectCase {
		selectCase := models.SelectCase{
			Index:       i,
			Type:        sc.Type,
			ChannelID:   sc.Channel,
			Value:       sc.Value,
			IsDefault:   sc.IsDefault,
			Description: sc.Description,
		}
		selectCases = append(selectCases, selectCase)
	}

	event.Metadata.SelectCases = selectCases

	selected := -1
	hasDefault := false

	for i, sc := range selectCases {
		if sc.IsDefault {
			hasDefault = true
			continue
		}

		ch := r.timeline.GetChannel(sc.Channel)
		if ch == nil {
			continue
		}

		switch sc.Type {
		case "send":
			if ch.State != models.ChannelStateClosed && ch.State != models.ChannelStateNil {
				if ch.IsBuffered() && !ch.IsBufferFull() {
					selected = i
				} else if ch.HasWaitingReceivers() {
					selected = i
				}
			}
		case "recv":
			if ch.State == models.ChannelStateNil {
				continue
			}
			if ch.State == models.ChannelStateClosed || ch.HasWaitingSenders() {
				selected = i
			} else if ch.IsBuffered() && !ch.IsBufferEmpty() {
				selected = i
			}
		}

		if selected >= 0 {
			break
		}
	}

	if selected < 0 && hasDefault {
		for i, sc := range selectCases {
			if sc.IsDefault {
				selected = i
				break
			}
		}
	}

	event.Metadata.SelectedCase = selected

	if selected >= 0 && selected < len(selectCases) {
		sc := selectCases[selected]
		if !sc.IsDefault {
			ch := r.timeline.GetChannel(sc.Channel)
			if ch != nil {
				switch sc.Type {
				case "send":
					r.processSend(models.StepDef{
						Action:    "send",
						Goroutine: step.Goroutine,
						Channel:   sc.Channel,
						Value:     sc.Value,
					})
				case "recv":
					r.processRecv(models.StepDef{
						Action:    "recv",
						Goroutine: step.Goroutine,
						Channel:   sc.Channel,
					})
				}
			}
		}
	} else {
		g := r.timeline.GetGoroutine(step.Goroutine)
		if g != nil && step.Timeout == "" {
			g.Block("select")
		}
	}

	return event
}

func (r *Replayer) SaveToDatabase() error {
	for _, event := range r.timeline.Events {
		if err := r.store.SaveEvent(event); err != nil {
			return fmt.Errorf("failed to save event: %w", err)
		}
	}

	for _, snapshot := range r.timeline.Snapshots {
		if err := r.store.SaveChannelSnapshot(snapshot); err != nil {
			return fmt.Errorf("failed to save snapshot: %w", err)
		}
	}

	for _, ch := range r.timeline.Channels {
		if err := r.store.SaveChannel(ch); err != nil {
			return fmt.Errorf("failed to save channel: %w", err)
		}
	}

	for _, g := range r.timeline.Goroutines {
		if err := r.store.SaveGoroutine(g); err != nil {
			return fmt.Errorf("failed to save goroutine: %w", err)
		}
	}

	fmt.Printf("Saved %d events, %d snapshots to database\n",
		len(r.timeline.Events), len(r.timeline.Snapshots))
	return nil
}

func (r *Replayer) PrintTimeline() {
	fmt.Println("\n=== Event Timeline ===")
	for i, event := range r.timeline.Events {
		fmt.Printf("[%d] %s - %s", i+1, event.Timestamp.Format(time.RFC3339), event.Type)
		if event.ChannelID != "" {
			fmt.Printf(" | Channel: %s", event.ChannelID)
		}
		if event.Goroutine != "" {
			fmt.Printf(" | Goroutine: %s", event.Goroutine)
		}
		if event.Value != nil {
			fmt.Printf(" | Value: %v", event.Value)
		}
		if event.Metadata.BlockReason != "" {
			fmt.Printf(" | Blocked: %s", event.Metadata.BlockReason)
		}
		fmt.Println()
	}
}

func (r *Replayer) PrintChannelSnapshots() {
	fmt.Println("\n=== Channel Snapshots ===")
	for i, snapshot := range r.timeline.Snapshots {
		fmt.Printf("\n--- Snapshot %d ---\n", i+1)
		fmt.Printf("Channel: %s\n", snapshot.ChannelID)
		fmt.Printf("State: %s\n", snapshot.State)
		fmt.Printf("Buffer: %d/%d\n", snapshot.BufferLength, snapshot.BufferSize)
		if snapshot.BufferLength > 0 {
			fmt.Printf("Buffer Content: %v\n", snapshot.Buffer)
		}
		fmt.Printf("Send Queue: %d goroutines\n", snapshot.SendqLength)
		fmt.Printf("Recv Queue: %d goroutines\n", snapshot.RecvqLength)
	}
}

func (r *Replayer) LoadAndReplay(casesFile, eventsFile string, caseID string) error {
	if eventsFile != "" {
		if err := r.LoadEventsFromFile(eventsFile); err != nil {
			return err
		}
	}

	if casesFile != "" {
		cases, err := models.LoadChannelCases(casesFile)
		if err != nil {
			return fmt.Errorf("failed to load cases: %w", err)
		}

		if caseID != "" {
			for _, c := range cases {
				if c.ID == caseID {
					if err := r.LoadCase(c); err != nil {
						return err
					}
					break
				}
			}
		} else {
			for _, c := range cases {
				if err := r.LoadCase(c); err != nil {
					return err
				}
			}
		}
	}

	if casesFile == "" && eventsFile == "" {
		casesFile = filepath.Join(".", "channel-cases.yaml")
		eventsFile = filepath.Join(".", "events.jsonl")

		if _, err := os.Stat(casesFile); err == nil {
			cases, err := models.LoadChannelCases(casesFile)
			if err == nil && len(cases) > 0 {
				for _, c := range cases {
					r.LoadCase(c)
				}
			}
		}

		if _, err := os.Stat(eventsFile); err == nil {
			r.LoadEventsFromFile(eventsFile)
		}
	}

	return nil
}
