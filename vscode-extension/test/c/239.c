#include <stdio.h>
#include <stdlib.h>

/**
 * Return an array of size *returnSize.
 * Note: The returned array must be malloced, assume caller calls free().
 */
int* maxSlidingWindow(int* nums, int numsSize, int k, int* returnSize)
{
    int i, left = 0, right = 0;
    int count = 0;
    int *indexes = malloc(numsSize * sizeof(int));
    int *results = malloc((numsSize - k + 1) * sizeof(int));

    for (i = 0; i < numsSize; i++) {
        /* keep the elements in slide window monotonous decreasing */
        while (right > left && nums[i] >= nums[indexes[right - 1]]) {
            /* squeeze out the previous smaller ones */
            right--;
        }

        /* In order to measure the moving size of the sliding window, we
         * need to store the index instead of element into the window.
         */
        indexes[right++] = i;

        /* let k = 1 to verify the corner case */
        if (i >= k - 1) {
            results[count++] = nums[indexes[left]];
        }

        if (i - indexes[left] + 1 >= k) {
            left++;
        }
    }

    *returnSize = count;
    return results;
}
