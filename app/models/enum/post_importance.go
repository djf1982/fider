package enum

// PostImportance is the self-rated importance a submitter assigns to a feature request.
// It is an input signal for triage, never a final priority.
type PostImportance int

var (
	// PostImportanceUnset is used when the submitter did not rate importance
	PostImportanceUnset PostImportance
	// PostImportanceNiceToHave is a low-priority "would be nice" request
	PostImportanceNiceToHave PostImportance = 1
	// PostImportanceImportant is a request that matters to the submitter
	PostImportanceImportant PostImportance = 2
	// PostImportanceCritical is a request the submitter considers a blocker
	PostImportanceCritical PostImportance = 3
)

var postImportanceIDs = map[PostImportance]string{
	PostImportanceUnset:      "",
	PostImportanceNiceToHave: "nice-to-have",
	PostImportanceImportant:  "important",
	PostImportanceCritical:   "critical",
}

var postImportanceNames = map[string]PostImportance{
	"":             PostImportanceUnset,
	"nice-to-have": PostImportanceNiceToHave,
	"important":    PostImportanceImportant,
	"critical":     PostImportanceCritical,
}

// IsValid returns true if the importance is a known value
func (importance PostImportance) IsValid() bool {
	_, ok := postImportanceIDs[importance]
	return ok
}

// MarshalText returns the text version of the post importance
func (importance PostImportance) MarshalText() ([]byte, error) {
	return []byte(postImportanceIDs[importance]), nil
}

// UnmarshalText parses a string into a post importance
func (importance *PostImportance) UnmarshalText(text []byte) error {
	*importance = postImportanceNames[string(text)]
	return nil
}

// Name returns the name of a post importance
func (importance PostImportance) Name() string {
	return postImportanceIDs[importance]
}
