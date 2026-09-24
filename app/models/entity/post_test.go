package entity_test

import (
	"testing"

	"github.com/getfider/fider/app/models/entity"
	. "github.com/getfider/fider/app/pkg/assert"
)

func TestPostSummary(t *testing.T) {
	RegisterT(t)

	testCases := []struct {
		description string
		expected    string
	}{
		{"Plain description", "Plain description"},
		{"**The problem**\n\nSlow export.", "Slow export."},
		{"**The problem**\n\nSlow export.\n\nIt takes minutes.\n\n**Ideal outcome**\n\nFast export.", "Slow export.\n\nIt takes minutes."},
		{"**The problem**\n\nSlow export.\n\n**Importance**\n\nCritical", "Slow export."},
		{"Intro\n\n**The problem**\n\nSlow export.", "Intro\n\n**The problem**\n\nSlow export."},
	}

	for _, tc := range testCases {
		post := &entity.Post{Description: tc.description}
		Expect(post.Summary()).Equals(tc.expected)
	}
}
