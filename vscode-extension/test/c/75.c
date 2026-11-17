#include <stdio.h>
#include <stdlib.h>
#include <string.h>


static inline void swap(int *a, int *b)
{
    int tmp = *a;
    *a = *b;
    *b = tmp;
}

void sortColors(int* nums, int numsSize)
{
    int i, j = 0;
    for (i = 0; i < numsSize; i++) {
        if (nums[i] == 0) {
            swap(nums + j, nums + i);
            j++;
        }
    }

    for (i = j; i < numsSize; i++) { 
        if (nums[i] == 1) {
            swap(nums + j, nums + i);
            j++;
        }
    }
}
