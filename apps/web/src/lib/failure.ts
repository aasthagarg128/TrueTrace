import type { Case } from "./api";

/**
 * One place that turns `failure_reason` into words a user reads. Three pages
 * show a failed case (overview, evidence, report), and before this existed
 * two of them said "content could not be retrieved" even when the real
 * reason was an identity mismatch — factually wrong, and confusing at the
 * exact moment someone needs a clear next step.
 */
export interface FailureCopy {
  title: string;
  body: string;
  /** Whether trying a different reference photo could plausibly fix this. */
  suggestRetryWithNewPhoto: boolean;
}

export function failureCopy(kase: Case): FailureCopy {
  switch (kase.failure_reason) {
    case "identity_mismatch":
      return {
        title: "The reference photo didn't match a face in this video",
        body:
          "This is an automated face comparison, and it is not perfect — poor lighting, an old photo, or an unusual angle can all cause a genuine match to be missed. It never means you did something wrong.",
        suggestRetryWithNewPhoto: true,
      };
    case "identity_no_face_in_reference":
      return {
        title: "We couldn't find a clear face in your reference photo",
        body:
          "Try a photo where your face is unobstructed, reasonably well lit, and facing roughly toward the camera.",
        suggestRetryWithNewPhoto: true,
      };
    case "identity_no_face_in_video_frames":
      return {
        title: "We couldn't find a clear face anywhere in this video",
        body:
          "The sampled frames may be too dark, too blurry, or never show a face straight-on. This is about the video's content, not your reference photo.",
        suggestRetryWithNewPhoto: false,
      };
    case "identity_check_unavailable":
      return {
        title: "The identity check is temporarily unavailable",
        body:
          "This is required before a case can proceed, and the service that runs it could not be reached. Nothing about your submission was wrong — please try again shortly.",
        suggestRetryWithNewPhoto: false,
      };
    case "no_frames":
      return {
        title: "We couldn't get a usable image from that video",
        body:
          "The content may be corrupted, region-locked, or in a format we can't decode. You can still report it — platforms act on your statement that you are the person depicted, not on whether our retrieval worked.",
        suggestRetryWithNewPhoto: false,
      };
    case "fetch":
    case "unexpected":
    default:
      return {
        title: "We could not retrieve that content",
        body:
          "The link may be private, already removed, behind a login, or on a site we cannot reach automatically. This is common and it is not your fault. You can still report it — platforms act on your statement that you are the person depicted, not on whether our retrieval worked.",
        suggestRetryWithNewPhoto: false,
      };
  }
}
